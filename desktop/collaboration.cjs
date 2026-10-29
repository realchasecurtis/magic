const net = require("node:net"),
  crypto = require("node:crypto"),
  os = require("node:os");
function channel(socket, secret, server, onMessage, onClose) {
  let buffer = Buffer.alloc(0),
    key = null,
    sendSequence = 0,
    receiveSequence = 0,
    ready = false;
  const salt = server ? crypto.randomBytes(32) : null;
  function derive(s) {
    key = Buffer.from(
      crypto.hkdfSync(
        "sha256",
        secret,
        s,
        Buffer.from("Magic collaboration v1"),
        32,
      ),
    );
    ready = true;
  }
  if (server) {
    derive(salt);
    socket.write(salt);
  }
  socket.setTimeout(30000);
  socket.on("timeout", () => socket.destroy());
  socket.on("error", () => {});
  socket.on("close", onClose);
  const send = (message) => {
    if (!ready) return false;
    const iv = crypto.randomBytes(12),
      cipher = crypto.createCipheriv("aes-256-gcm", key, iv),
      data = Buffer.from(JSON.stringify({ seq: sendSequence++, message })),
      encrypted = Buffer.concat([cipher.update(data), cipher.final()]),
      body = Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
      size = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    socket.write(Buffer.concat([size, body]));
    return true;
  };
  socket.on("data", (data) => {
    try {
      buffer = Buffer.concat([buffer, data]);
      if (!ready) {
        if (buffer.length < 32) return;
        derive(buffer.subarray(0, 32));
        buffer = buffer.subarray(32);
        onMessage({ type: "ready" }, send);
      }
      while (buffer.length >= 4) {
        const length = buffer.readUInt32BE(0);
        if (length < 28 || length > 256 * 1024 * 1024)
          throw Error("Invalid session packet.");
        if (buffer.length < length + 4) return;
        const body = buffer.subarray(4, length + 4);
        buffer = buffer.subarray(length + 4);
        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          key,
          body.subarray(0, 12),
        );
        decipher.setAuthTag(body.subarray(12, 28));
        const payload = JSON.parse(
          Buffer.concat([
            decipher.update(body.subarray(28)),
            decipher.final(),
          ]).toString(),
        );
        if (payload.seq !== receiveSequence++)
          throw Error("Invalid session sequence.");
        onMessage(payload.message, send);
      }
    } catch {
      socket.destroy();
    }
  });
  return send;
}
class Collaboration {
  constructor(emit, apply, validate) {
    this.emit = emit;
    this.apply = apply;
    this.validate = validate;
    this.peers = new Map();
    this.id = crypto.randomUUID();
  }
  async host(project, name, bind = "0.0.0.0") {
    this.leave();
    this.project = this.validate(project);
    this.secret = crypto.randomBytes(32);
    this.name = name;
    this.server = net.createServer((socket) => {
      const id = crypto.randomUUID();
      let joined = false;
      const send = channel(
        socket,
        this.secret,
        true,
        (message) => {
          if (!joined) {
            if (message.type !== "hello") return socket.destroy();
            joined = true;
            this.peers.set(id, {
              socket,
              send,
              name: String(message.name || "Guest").slice(0, 60),
            });
            send({ type: "snapshot", project: this.project, id });
            this.broadcast({
              type: "presence",
              id,
              name: this.peers.get(id).name,
            });
            return;
          }
          this.receive({ ...message, id, name: this.peers.get(id).name });
        },
        () => {
          this.peers.delete(id);
          if (joined) this.broadcast({ type: "left", id });
        },
      );
    });
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, bind, resolve);
    });
    this.server.on("error", (e) =>
      this.emit({ type: "error", message: e.message }),
    );
    const port = this.server.address().port,
      addresses =
        bind !== "0.0.0.0"
          ? [bind]
          : Object.values(os.networkInterfaces())
              .flat()
              .filter((a) => a.family === "IPv4" && !a.internal)
              .map((a) => a.address);
    this.timer = setInterval(() => this.broadcast({ type: "ping" }), 10000);
    return {
      id: this.id,
      codes: (addresses.length ? addresses : ["127.0.0.1"]).map(
        (host) =>
          "magic-share://" +
          host +
          ":" +
          port +
          "/" +
          this.secret.toString("hex"),
      ),
      local:
        "magic-share://127.0.0.1:" + port + "/" + this.secret.toString("hex"),
    };
  }
  async join(code, name) {
    this.leave();
    const url = new URL(code);
    if (
      url.protocol !== "magic-share:" ||
      !/^\/[a-f0-9]{64}$/.test(url.pathname) ||
      !url.hostname ||
      !url.port
    )
      throw Error("Invalid invitation.");
    this.name = name;
    this.socket = net.connect({ host: url.hostname, port: Number(url.port) });
    await new Promise((resolve, reject) => {
      let done = false;
      this.socket.once("error", reject);
      this.send = channel(
        this.socket,
        Buffer.from(url.pathname.slice(1), "hex"),
        false,
        (message, send) => {
          if (message.type === "ready") {
            send({ type: "hello", name });
            return;
          }
          if (message.type === "ping") {
            send({ type: "ping" });
            return;
          }
          if (message.type === "snapshot") {
            this.id = message.id;
            done = true;
            resolve(message);
          }
          this.emit(message);
        },
        () => {
          this.emit({ type: "disconnected" });
          if (!done)
            reject(
              Error("Could not join. Check the invitation, network and host."),
            );
        },
      );
    });
    this.timer = setInterval(() => this.send?.({ type: "ping" }), 10000);
    return true;
  }
  broadcast(message) {
    this.emit(message);
    for (const peer of this.peers.values()) peer.send(message);
  }
  receive(message) {
    if (message.type === "ping") return;
    if (message.type === "patch") {
      try {
        this.project = this.validate(this.apply(this.project, message.ops));
        this.broadcast(message);
      } catch (e) {
        this.emit({ type: "error", message: e.message });
        const peer = this.peers.get(message.id);
        peer?.send({
          type: "snapshot",
          project: this.project,
          id: message.id,
          error: "Change rejected: " + e.message,
        });
      }
    } else if (message.type === "presence") {
      this.broadcast({
        type: "presence",
        id: message.id,
        name: message.name,
        page: message.page,
        cursor: message.cursor,
        selection: message.selection,
        view: message.view,
      });
    }
  }
  publish(message) {
    if (this.server) this.receive({ ...message, id: this.id, name: this.name });
    else this.send?.(message);
  }
  leave() {
    clearInterval(this.timer);
    this.socket?.destroy();
    this.socket = null;
    for (const p of this.peers.values()) p.socket.destroy();
    this.peers.clear();
    this.server?.close();
    this.server = null;
    this.send = null;
  }
}
module.exports = { Collaboration };
