import { pathToFileURL } from 'node:url';
const { packager } = await import(process.env.MAGIC_PACKAGER_MODULE ? pathToFileURL(process.env.MAGIC_PACKAGER_MODULE).href : '@electron/packager');
import { readFile } from "node:fs/promises";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const paths = await packager({
  dir: ".",
  out: `dist/${version}`,
  name: "Magic",
  platform: "win32",
  arch: "x64",
  overwrite: true,
  electronVersion: "45.0.0",
  electronZipDir: process.env.MAGIC_ELECTRON_ZIP_DIR,
  prune: false,
  asar: false,
  ignore: file => !!file && !['assets','desktop','src','vendor'].includes(file.split('/')[1]) && !['/index.html','/style.css','/theme.css','/package.json','/LICENSE'].includes(file),
  icon: "assets/magic.ico",
  executableName: "Magic",
  appVersion: version,
  win32metadata: {
    CompanyName: "Magic contributors",
    FileDescription: "Magic creative workspace",
    ProductName: "Magic",
    InternalName: "Magic",
  },
});
console.log(paths.join("\n"));
