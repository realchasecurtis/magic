import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { convert, run } = require("../desktop/media-conversion.cjs"),
  exe = path.resolve("test-results/media-engine/ffmpeg.exe"),
  probe = path.join(path.dirname(exe), "ffprobe.exe"),
  dir = path.resolve("test-results/webm11");
await fs.mkdir(dir, { recursive: true });
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  for (const [name, codec, pix] of [
    ["vp8", "libvpx", "yuv420p"],
    ["vp9", "libvpx-vp9", "yuv420p"],
    ["vp9-10bit", "libvpx-vp9", "yuv420p10le"],
  ]) {
    const source = path.join(dir, name + ".webm");
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
      "2",
      "-c:v",
      codec,
      "-pix_fmt",
      pix,
      "-c:a",
      "libopus",
      source,
    ]);
    const output = await convert(
      exe,
      await fs.readFile(source),
      name + ".webm",
      "MP4",
      dir,
      () => {},
      new AbortController().signal,
    );
    const meta = JSON.parse(
      await run(probe, [
        "-v",
        "error",
        "-count_frames",
        "-show_entries",
        "stream=codec_type,codec_name,nb_read_frames,pix_fmt",
        "-of",
        "json",
        output,
      ]),
    );
    const v = meta.streams.find((s) => s.codec_type === "video");
    assert.equal(v.codec_name, "h264");
    assert.equal(v.pix_fmt, "yuv420p");
    assert.ok(Number(v.nb_read_frames) >= 45);
    assert.ok(meta.streams.some((s) => s.codec_type === "audio"));
    const page = await browser.newPage();
    await page.setContent("<video muted></video>");
    const data = (await fs.readFile(output)).toString("base64");
    const result = await page.evaluate(async (data) => {
      const v = document.querySelector("video");
      v.src = "data:video/mp4;base64," + data;
      await v.play();
      await new Promise((r) => setTimeout(r, 500));
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const x = c.getContext("2d");
      x.drawImage(v, 0, 0);
      const bytes = x.getImageData(0, 0, c.width, c.height).data;
      let min = 255,
        max = 0;
      for (let i = 0; i < bytes.length; i += 4) {
        min = Math.min(min, bytes[i]);
        max = Math.max(max, bytes[i]);
      }
      return { time: v.currentTime, width: v.videoWidth, range: max - min };
    }, data);
    assert.ok(result.time > 0 && result.width === 320 && result.range > 100);
    await page.close();
    await fs.copyFile(output, path.join(dir, name + ".mp4"));
    console.log(
      name +
        ": H.264 video frames + AAC audio; visible moving playback in Edge passed.",
    );
  }
} finally {
  await browser.close();
}
