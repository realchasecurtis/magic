import { projectPatch, applyPatch } from "./project-sync.js";
export function installSharing({
  dialog,
  toast,
  getCurrent,
  getProject,
  addProject,
  replaceProject,
  getPresence,
  render,
  save,
  escape: esc,
}) {
  const $ = (s) => document.querySelector(s),
    api = window.magicDesktop;
  let shared = null,
    baseline = null,
    selfId = null,
    peers = new Map(),
    busy = false;
  const stop = async () => {
    await api?.leaveShare();
    shared = null;
    baseline = null;
    peers.clear();
    $("#share-button").classList.remove("sharing");
    $("#collaborators")?.remove();
  };
  const commit = () => {
    if (!shared || busy) return;
    const project = getProject(shared);
    if (!project) return;
    const ops = projectPatch(baseline, project);
    if (ops.length) {
      baseline = structuredClone(project);
      api.publishShare({ type: "patch", ops });
    }
  };
  api?.onShare((message) => {
    try {
      if (message.type === "snapshot") {
        if (!shared) {
          const p = structuredClone(message.project);
          p.id = crypto.randomUUID();
          shared = p.id;
          addProject(p);
        } else replaceProject(shared, message.project);
        baseline = structuredClone(getProject(shared));
        selfId = message.id;
        $("#share-button").classList.add("sharing");
        render();
        save();
        if (message.error) toast(message.error);
      } else if (message.type === "patch" && shared && message.id !== selfId) {
        commit();
        const project = applyPatch(getProject(shared), message.ops);
        replaceProject(shared, project);
        baseline = applyPatch(baseline, message.ops);
        render();
        save();
      } else if (message.type === "presence" && message.id !== selfId) {
        peers.set(message.id, { ...message, seen: Date.now() });
        draw();
      } else if (message.type === "left") {
        peers.delete(message.id);
        draw();
      } else if (message.type === "disconnected") {
        shared = null;
        baseline = null;
        peers.clear();
        $("#share-button").classList.remove("sharing");
        $("#collaborators")?.remove();
        toast("Shared session ended. Your local project copy is saved.");
      } else if (message.type === "error") toast(message.message);
    } catch (e) {
      toast("Shared change could not be applied: " + e.message);
    }
  });
  function draw() {
    $("#collaborators")?.remove();
    if (!shared || getCurrent().id !== shared) return;
    const el = document.createElement("div");
    el.id = "collaborators";
    el.style.pointerEvents = "none";
    const presence = getPresence(),
      palette = ["#ffb84d", "#f482da", "#7be3a2", "#a69bff"];
    let i = 0;
    for (const [id, peer] of peers) {
      if (Date.now() - peer.seen > 15000) {
        peers.delete(id);
        continue;
      }
      if (peer.page !== presence.page) continue;
      const color = palette[i++ % palette.length],
        z = presence.zoom;
      const box = (b, extra = "") => {
        if (!b || ![b.x, b.y, b.w, b.h].every(Number.isFinite)) return "";
        return (
          '<div style="position:absolute;left:' +
          b.x +
          "px;top:" +
          b.y +
          "px;width:" +
          b.w +
          "px;height:" +
          b.h +
          "px;border:" +
          1 / z +
          "px " +
          extra +
          " " +
          color +
          ';pointer-events:none"></div>'
        );
      };
      el.innerHTML += box(peer.view, "dashed");
      for (const node of getCurrent().pages.find((p) => p.id === peer.page)
        ?.nodes || [])
        if (peer.selection?.includes(node.id))
          el.innerHTML += box(node, "solid");
      if (
        peer.cursor &&
        Number.isFinite(peer.cursor.x) &&
        Number.isFinite(peer.cursor.y)
      )
        el.innerHTML +=
          '<div style="position:absolute;left:' +
          peer.cursor.x +
          "px;top:" +
          peer.cursor.y +
          "px;color:" +
          color +
          ";font-size:" +
          12 / z +
          'px;white-space:nowrap;pointer-events:none">➤ <span style="background:' +
          color +
          ';color:#172026;padding:2px 5px">' +
          esc(peer.name || "Guest") +
          "</span></div>";
    }
    $("#world").append(el);
  }
  setInterval(() => {
    if (!shared) return;
    commit();
    if (getCurrent().id === shared)
      api.publishShare({ type: "presence", ...getPresence() });
    draw();
  }, 150);
  $("#share-button").onclick = () => {
    if (!api?.hostShare) {
      toast("Live collaboration is available in the Magic desktop app.");
      return;
    }
    dialog(
      '<h2>Work together</h2><p>Host this project or join with an invitation. Participants need to reach the host on the same LAN or VPN. Edits and presence are shared; menus, dialogs, microphone and webcam are private.</p><label>Your display name<input id="share-name" value="' +
        esc(localStorage.getItem("magic-share-name") || "Designer") +
        '"></label><button id="host-share" class="primary" ' +
        (shared ? "disabled" : "") +
        '>Host this project</button><label>Invitation<input id="share-invite" placeholder="magic-share://…"></label><button id="join-share" ' +
        (shared ? "disabled" : "") +
        '>Join project</button><p id="share-status">' +
        (shared
          ? "Session active. Keep the host running."
          : "No session active.") +
        '</p><button id="leave-share" ' +
        (!shared ? "disabled" : "") +
        ">Leave / stop sharing</button>",
    );
    const name = () => {
      const value = $("#share-name").value.trim() || "Designer";
      localStorage.setItem("magic-share-name", value);
      return value;
    };
    $("#host-share").onclick = async () => {
      try {
        const project = structuredClone(getCurrent());
        const result = await api.hostShare(project, name());
        shared = project.id;
        baseline = project;
        selfId = result.id;
        $("#share-button").classList.add("sharing");
        $("#share-invite").value = result.codes[0];
        $("#share-status").textContent =
          "Send this invitation to your collaborator. Anyone holding it can edit while this session is running.";
        $("#share-invite").select();
        $("#leave-share").disabled = false;
        $("#host-share").disabled = $("#join-share").disabled = true;
      } catch (e) {
        $("#share-status").textContent = e.message;
      }
    };
    $("#join-share").onclick = async () => {
      busy = true;
      try {
        await api.joinShare($("#share-invite").value.trim(), name());
        $("#dialog").close();
        toast("Connected to shared project.");
      } catch (e) {
        $("#share-status").textContent = e.message;
      } finally {
        busy = false;
      }
    };
    $("#leave-share").onclick = async () => {
      await stop();
      $("#dialog").close();
      toast("Sharing stopped; local project retained.");
    };
  };
  return { draw };
}
