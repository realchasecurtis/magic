const { ipcMain, dialog, net } = require("electron"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { ensureEngine, convert } = require("./media-conversion.cjs");
module.exports = function (app, window) {
  let active = null;
  const trusted = (event) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame;
  ipcMain.handle("media-convert", async (event, { bytes, name, format }) => {
    if (!trusted(event) || active)
      throw Error("A media conversion is already running.");
    if (
      ![
        "WAV",
        "MP3",
        "FLAC",
        "OGG",
        "M4A",
        "MP4",
        "MOV",
        "WEBM",
        "MKV",
      ].includes(format)
    )
      throw Error("Unsupported output format");
    const controller = new AbortController();
    active = controller;
    let directory;
    try {
      const progress = (data) => {
          if (!window.isDestroyed())
            window.webContents.send("media-progress", data);
        },
        exe = await ensureEngine(app, net, progress, controller.signal);
      directory = await fs.mkdtemp(
        path.join(app.getPath("temp"), "magic-convert-"),
      );
      const output = await convert(
        exe,
        bytes,
        String(name),
        format,
        directory,
        progress,
        controller.signal,
      );
      if (controller.signal.aborted) throw Error("Conversion canceled.");
      const result = await dialog.showSaveDialog(window, {
        title: "Save converted media",
        defaultPath:
          path.basename(name, path.extname(name)) + "." + format.toLowerCase(),
        filters: [{ name: format, extensions: [format.toLowerCase()] }],
      });
      if (result.canceled) return { canceled: true };
      const extension = "." + format.toLowerCase();
      const destination = result.filePath.toLowerCase().endsWith(extension)
        ? result.filePath
        : result.filePath + extension;
      await fs.copyFile(
        output,
        destination,
        destination === result.filePath
          ? 0
          : require("node:fs").constants.COPYFILE_EXCL,
      );
      return { saved: true };
    } finally {
      active = null;
      if (
        directory &&
        path
          .resolve(directory)
          .startsWith(
            path.resolve(app.getPath("temp")) + path.sep + "magic-convert-",
          )
      )
        await fs
          .rm(directory, { recursive: true, force: true })
          .catch(() => {});
    }
  });
  ipcMain.handle("media-cancel", (event) => {
    if (trusted(event)) active?.abort();
  });
  window.on("closed", () => active?.abort());
};
