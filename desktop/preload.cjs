const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("magicDesktop", {
  previewRecording: (options) => ipcRenderer.invoke("record-preview", options),
  armRecording: (options) => ipcRenderer.invoke("record-arm", options),
  recordChunk: (bytes) => ipcRenderer.invoke("record-chunk", bytes),
  finishRecording: (cancel) => ipcRenderer.invoke("record-finish", cancel),
  hostShare: (project, name) => ipcRenderer.invoke("share-host", project, name),
  joinShare: (code, name) => ipcRenderer.invoke("share-join", code, name),
  leaveShare: () => ipcRenderer.invoke("share-leave"),
  publishShare: (message) => ipcRenderer.send("share-publish", message),
  onShare: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("share-event", listener);
    return () => ipcRenderer.removeListener("share-event", listener);
  },
  convertMedia: (options) => ipcRenderer.invoke("media-convert", options),
  cancelMedia: () => ipcRenderer.invoke("media-cancel"),
  onMediaProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("media-progress", listener);
    return () => ipcRenderer.removeListener("media-progress", listener);
  },
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
});
