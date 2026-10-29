import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url),
  { convert, run } = require("../desktop/media-conversion.cjs"),
  exe = path.resolve("test-results/media-engine/ffmpeg.exe"),
  dir = path.resolve("test-results/media6");
await fs.mkdir(dir, { recursive: true });
await run(exe, [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=320x240:rate=24",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440",
  "-t",
  "4",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  path.join(dir, "sample.mp4"),
]);
const bytes = await fs.readFile(path.join(dir, "sample.mp4"));
for (const format of [
  "MOV",
  "WEBM",
  "MKV",
  "MP3",
  "WAV",
  "FLAC",
  "OGG",
  "M4A",
]) {
  const events = [];
  const output = await convert(
    exe,
    bytes,
    "sample.mp4",
    format,
    dir,
    (p) => events.push(p),
    new AbortController().signal,
  );
  assert.ok((await fs.stat(output)).size > 100);
  assert.equal(events.at(-1).percent, 100);
  console.log("Converted", format);
}
for (const name of ["output.mov", "output.webm", "output.mkv"]) {
  await convert(
    exe,
    await fs.readFile(path.join(dir, name)),
    name,
    "MP4",
    dir,
    () => {},
    new AbortController().signal,
  );
  console.log("Validated round trip", name, "to MP4");
}
const controller = new AbortController();
controller.abort();
await assert.rejects(
  convert(exe, bytes, "sample.mp4", "MOV", dir, () => {}, controller.signal),
  /canceled/,
);
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage();
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  await page.locator("#file-input").setInputFiles(path.join(dir, "sample.mp4"));
  await page.waitForSelector(".node.selected .attachment");
  assert.equal(await page.locator("video,audio").count(), 0);
  await page.locator(".node.selected").dblclick();
  assert.equal(await page.locator("video,audio").count(), 0);
  assert.match(await page.locator("#export-panel").textContent(), /MOV/);
  await page.locator("#file-input").setInputFiles(path.join(dir, "output.mp3"));
  await page.waitForSelector(".node.selected .attachment");
  assert.equal(await page.locator("video,audio").count(), 0);
  assert.match(await page.locator("#export-panel").textContent(), /WAV/);
  console.log(
    "Media imports as attachment cards; conversion formats remain available.",
  );
} finally {
  await browser.close();
}
