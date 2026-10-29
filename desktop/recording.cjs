const { ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
module.exports = function setupRecording(app, window) {
  let session = null,
    preview = null;
  const trusted = (event) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame;
  window.webContents.session.setPermissionCheckHandler(
    (wc, permission) =>
      wc === window.webContents &&
      (!!session || (preview && permission === "media")) &&
      ["media", "display-capture"].includes(permission),
  );
  window.webContents.session.setPermissionRequestHandler(
    (wc, permission, callback, details) =>
      callback(
        wc === window.webContents &&
          details.isMainFrame !== false &&
          (!!session || !!preview) &&
          ((!!session && ["display-capture"].includes(permission)) ||
            (permission === "media" &&
              (details.mediaTypes || []).every((t) =>
                t === "audio"
                  ? (session || preview).microphone
                  : t === "video"
                    ? (session || preview).camera
                    : false,
              ))),
      ),
  );
  window.webContents.session.setDisplayMediaRequestHandler(
    (request, callback) => {
      if (!session || request.frame !== window.webContents.mainFrame)
        return callback(null);
      callback({
        video: window.webContents.mainFrame,
        ...(request.audioRequested && session.systemAudio
          ? { audio: "loopback" }
          : {}),
      });
    },
  );
  ipcMain.handle("record-preview", (event, options) => {
    if (!trusted(event)) throw Error("Unavailable");
    preview = options
      ? { microphone: !!options.microphone, camera: !!options.camera }
      : null;
    return true;
  });
  ipcMain.handle("record-arm", async (event, options) => {
    if (!trusted(event) || session) throw Error("Recording unavailable.");
    const file = path.join(
      app.getPath("temp"),
      "magic-recording-" + crypto.randomUUID() + ".webm",
    );
    session = {
      microphone: !!options.microphone,
      camera: !!options.camera,
      systemAudio: !!options.systemAudio,
      file,
      queue: Promise.resolve(),
      handle: await fs.open(file, "wx"),
    };
    return true;
  });
  ipcMain.handle("record-chunk", async (event, bytes) => {
    if (!trusted(event) || !session) throw Error("No recording session.");
    const active = session;
    active.queue = active.queue.then(() =>
      active.handle.write(Buffer.from(bytes)),
    );
    await active.queue;
  });
  ipcMain.handle("record-finish", async (event, cancel = false) => {
    if (!trusted(event) || !session) return;
    const active = session;
    session = null;
    await active.queue;
    await active.handle.close();
    if (cancel) {
      await fs.unlink(active.file).catch(() => {});
      return;
    }
    const result = await dialog.showSaveDialog(window, {
      title: "Save Magic recording",
      defaultPath: "Magic-recording.webm",
      filters: [{ name: "WebM video", extensions: ["webm"] }],
    });
    if (result.canceled) {
      await fs.unlink(active.file).catch(() => {});
      return { canceled: true };
    }
    try {
      await fs.copyFile(active.file, result.filePath);
      await fs.unlink(active.file);
      return { saved: true };
    } catch (e) {
      return {
        error: "Could not save recording. Recovery copy: " + active.file,
      };
    }
  });
  window.on("closed", () => {
    if (session) {
      const active = session;
      session = null;
      active.queue.finally(() => active.handle.close());
    }
  });
};
