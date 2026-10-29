const {
  app,
  BrowserWindow,
  Menu,
  protocol,
  net,
  ipcMain,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "magic",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);
app.setName("Magic");
if (process.env.MAGIC_TEST_PROFILE)
  app.setPath("userData", process.env.MAGIC_TEST_PROFILE);
if (!app.requestSingleInstanceLock()) app.quit();
let window;
app.on("second-instance", () => {
  if (window) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
});
app.whenReady().then(async () => {
  const root = path.resolve(__dirname, "..");
  protocol.handle("magic", (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const file = path.resolve(root, "." + relative);
    if (url.host !== "app" || !file.startsWith(root + path.sep))
      return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
  Menu.setApplicationMenu(null);
  window = new BrowserWindow({
    title: "Magic",
    width: 1500,
    height: 980,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: "#202326",
    icon: path.join(root, "assets", "mark.png"),
    show: !process.argv.some((arg) =>
      ["--smoke-test", "--test-hidden"].includes(arg),
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("magic://app/")) event.preventDefault();
  });
  const updater = require('./update-service.cjs').createUpdater({
    fetch: (...args) => net.fetch(...args), current: app.getVersion(),
    downloadDirectory: app.getPath('downloads'), reveal: file => require('electron').shell.showItemInFolder(file)
  });
  const ownsUpdate = event => event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url.startsWith('magic://app/');
  ipcMain.handle('check-updates', event => { if (!ownsUpdate(event)) throw Error('Access denied'); return updater.check(); });
  ipcMain.handle('download-update', event => { if (!ownsUpdate(event)) throw Error('Access denied'); return updater.download(); });
  require("./recording.cjs")(app, window);
  require("./media-ipc.cjs")(app, window);
  const { applyPatch } = await import("../src/project-sync.js"),
    { validateProject } = await import("../src/model.js");
  const { Collaboration } = require("./collaboration.cjs");
  const collaboration = new Collaboration(
    (message) => {
      if (!window.isDestroyed())
        window.webContents.send("share-event", message);
    },
    applyPatch,
    validateProject,
  );
  const own = (event) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame;
  ipcMain.handle("share-host", (event, project, name) => {
    if (!own(event)) throw Error("Access denied");
    return collaboration.host(
      project,
      String(name).slice(0, 60),
      process.env.MAGIC_TEST_PROFILE ? "127.0.0.1" : "0.0.0.0",
    );
  });
  ipcMain.handle("share-join", (event, code, name) => {
    if (!own(event)) throw Error("Access denied");
    return collaboration.join(code, String(name).slice(0, 60));
  });
  ipcMain.handle("share-leave", (event) => {
    if (own(event)) collaboration.leave();
  });
  ipcMain.on("share-publish", (event, message) => {
    if (own(event)) collaboration.publish(message);
  });
  window.on("closed", () => collaboration.leave());
  window.webContents.session.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      title: "Save from Magic",
      defaultPath: path.join(
        app.getPath("downloads"),
        path.basename(item.getFilename()),
      ),
    });
  });
  window.on("page-title-updated", (event) => event.preventDefault());
  await window.loadURL("magic://app/");
  if (process.argv.includes("--smoke-test")) {
    const result = await window.webContents.executeJavaScript(
      `new Promise(resolve=>{const check=()=>document.querySelectorAll('.node').length?resolve({title:document.title,nodes:document.querySelectorAll('.node').length,exportPanel:!!document.querySelector('#export-panel'),brand:document.querySelector('.brand img').getAttribute('src')}):setTimeout(check,50);check();})`,
    );
    fs.writeFileSync(
      path.join(process.env.MAGIC_TEST_PROFILE || root, "desktop-smoke.json"),
      JSON.stringify(result, null, 2),
    );
    app.quit();
  }
});
app.on("window-all-closed", () => app.quit());
