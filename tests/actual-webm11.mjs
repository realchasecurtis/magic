import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { run } = require("../desktop/media-conversion.cjs"),
  { _electron } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  profile = path.resolve("desktop-test-profile", "actual-webm-" + Date.now());
await fs.mkdir(profile, { recursive: true });
const output = path.resolve("test-results/Magic-recording-converted.mp4"),
  app = await _electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: [".", "--test-hidden"],
    env: {
      ...process.env,
      MAGIC_TEST_PROFILE: profile,
      MAGIC_TEST_FFMPEG_PATH: path.resolve(
        "test-results/media-engine/ffmpeg.exe",
      ),
    },
  });
try {
  const page = await app.firstWindow();
  await page.waitForSelector(".node");
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  await page.locator("#file-input").setInputFiles(process.env.MAGIC_WEBM_INPUT);
  await page.locator("#export-format").selectOption("MP4");
  assert.match(await page.locator("#export-design").textContent(), /MP4/);
  await page.locator("#export-design").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#toast")?.textContent ===
      "Converted media saved.",
    {},
    { timeout: 120000 },
  );
  const metadata = JSON.parse(
    await run(path.resolve("test-results/media-engine/ffprobe.exe"), [
      "-v",
      "error",
      "-count_frames",
      "-show_entries",
      "format=duration:stream=codec_type,codec_name,width,height,nb_read_frames",
      "-of",
      "json",
      output,
    ]),
  );
  console.log(JSON.stringify(metadata));
  assert.ok(
    metadata.streams.some(
      (s) => s.codec_type === "video" && Number(s.nb_read_frames) > 1,
    ),
  );
  assert.ok(metadata.streams.some((s) => s.codec_type === "audio"));
  console.log(
    "User recording imported and exported through actual MP4 UI successfully.",
  );
} finally {
  await app.close();
}
