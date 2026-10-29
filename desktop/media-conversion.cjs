const { spawn } = require("node:child_process"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const manifest = require("./media-engine.json");
function run(executable, args, { signal, onData } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error("Conversion canceled."));
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    const cancel = () => child.kill();
    signal?.addEventListener("abort", cancel, { once: true });
    child.on("error", reject);
    child.stdout.on("data", (data) => {
      stdout = (stdout + data).slice(-100000);
      onData?.(String(data));
    });
    child.stderr.on("data", (data) => (stderr = (stderr + data).slice(-12000)));
    child.on("close", (code) => {
      signal?.removeEventListener("abort", cancel);
      if (signal?.aborted) reject(Error("Conversion canceled."));
      else if (code === 0) resolve(stdout);
      else
        reject(
          Error(
            stderr.split("\n").filter(Boolean).slice(-4).join(" ") ||
              "Media tool failed.",
          ),
        );
    });
  });
}
async function ensureEngine(app, net, progress, signal) {
  if (process.env.MAGIC_TEST_PROFILE && process.env.MAGIC_TEST_FFMPEG_PATH)
    return process.env.MAGIC_TEST_FFMPEG_PATH;
  const root = path.join(
      app.getPath("userData"),
      "media-engine",
      manifest.version,
    ),
    exe = path.join(root, manifest.folder, "bin", "ffmpeg.exe");
  try {
    await fs.access(exe);
    await fs.access(path.join(root, "ready"));
    return exe;
  } catch {}
  await fs.mkdir(root, { recursive: true });
  const archive = path.join(root, "engine.zip");
  progress({ stage: "Downloading media engine", percent: 0 });
  const response = await net.fetch(manifest.url, { signal });
  if (!response.ok)
    throw Error("Media engine download failed: " + response.status);
  const size = Number(response.headers.get("content-length")),
    hash = crypto.createHash("sha256"),
    file = await fs.open(archive, "w");
  let read = 0;
  try {
    for await (const chunk of response.body) {
      if (signal.aborted) throw Error("Conversion canceled.");
      await file.write(chunk);
      hash.update(chunk);
      read += chunk.length;
      progress({
        stage: "Downloading media engine",
        percent: size ? Math.min(99, (read / size) * 100) : null,
      });
    }
  } finally {
    await file.close();
  }
  if (hash.digest("hex") !== manifest.sha256) {
    await fs.unlink(archive);
    throw Error("Media engine checksum mismatch.");
  }
  progress({ stage: "Installing local media engine", percent: null });
  await run(
    path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"),
    ["-xf", archive, "-C", root],
    { signal },
  );
  await fs.unlink(archive);
  await fs.access(exe);
  await fs.writeFile(path.join(root, "ready"), manifest.sha256);
  return exe;
}
const inputFormats = {
  mp3: "mp3",
  wav: "wav",
  flac: "flac",
  ogg: "ogg",
  opus: "ogg",
  m4a: "mov",
  aac: "aac",
  mp4: "mov",
  mov: "mov",
  webm: "matroska",
  mkv: "matroska",
  avi: "avi",
  wma: "asf",
  wmv: "asf",
};
const codecs = {
  WAV: ["-vn", "-c:a", "pcm_s16le"],
  MP3: ["-vn", "-c:a", "libmp3lame", "-q:a", "2"],
  FLAC: ["-vn", "-c:a", "flac"],
  OGG: ["-vn", "-c:a", "libvorbis", "-q:a", "5"],
  M4A: ["-vn", "-c:a", "aac", "-b:a", "192k"],
  MP4: [
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
  ],
  MOV: [
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
  ],
  WEBM: ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-c:a", "libopus"],
  MKV: ["-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac"],
};
async function convert(exe, bytes, name, format, directory, progress, signal) {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (!inputFormats[ext] || !codecs[format])
    throw Error("Unsupported media conversion.");
  const input = path.join(directory, "input." + ext),
    output = path.join(directory, "output." + format.toLowerCase());
  await fs.writeFile(input, Buffer.from(bytes));
  const restricted = [
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      inputFormats[ext],
    ],
    probe = path.join(path.dirname(exe), "ffprobe.exe");
  progress({ stage: "Reading media", percent: null });
  const metadata = JSON.parse(
    await run(
      probe,
      [
        "-v",
        "error",
        ...restricted,
        "-i",
        input,
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
      ],
      { signal },
    ),
  );
  const duration = Number(metadata.format?.duration) || 0,
    video = ["MP4", "MOV", "WEBM", "MKV"].includes(format);
  if (video && !metadata.streams?.some((s) => s.codec_type === "video"))
    throw Error("Select an audio export format for an audio-only file.");
  if (!video && !metadata.streams?.some((s) => s.codec_type === "audio"))
    throw Error("This media has no audio track to export.");
  let pending = "";
  progress({ stage: "Converting", percent: 0 });
  await run(
    exe,
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      ...restricted,
      "-i",
      input,
      ...(video
        ? [
            "-map",
            "0:V:0",
            "-map",
            "0:a:0?",
            "-vf",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
          ]
        : ["-map", "0:a:0"]),
      ...codecs[format],
      ...(video ? ["-pix_fmt", "yuv420p"] : []),
      "-threads",
      "2",
      "-progress",
      "pipe:1",
      "-nostats",
      output,
    ],
    {
      signal,
      onData: (data) => {
        pending += data;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop();
        for (const line of lines) {
          const [key, value] = line.split("=");
          if (key === "out_time_us")
            progress({
              stage: "Converting",
              percent: duration
                ? Math.min(99, (Number(value) / 1e6 / duration) * 100)
                : null,
            });
        }
      },
    },
  );
  progress({ stage: "Validating converted media", percent: null });
  const verified = JSON.parse(
    await run(
      probe,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        output,
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,width,height",
        "-of",
        "json",
      ],
      { signal },
    ),
  );
  if (
    !verified.streams?.some((s) => s.codec_type === (video ? "video" : "audio"))
  )
    throw Error("Converted output is missing its required media stream.");
  const actualDuration = Number(verified.format?.duration);
  if (
    duration > 0 &&
    (!Number.isFinite(actualDuration) ||
      Math.abs(actualDuration - duration) > Math.max(1, duration * 0.05))
  )
    throw Error(
      "Converted output duration does not match the source. Export was stopped.",
    );
  const validation = await run(
    exe,
    [
      "-v",
      "error",
      "-xerror",
      "-err_detect",
      "explode",
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      output,
      "-map",
      "0:v?",
      "-map",
      "0:a?",
      "-progress",
      "pipe:1",
      "-nostats",
      "-f",
      "null",
      "-",
    ],
    { signal },
  );
  const decodedFrames = [...validation.matchAll(/^frame=(\d+)/gm)].reduce(
    (max, m) => Math.max(max, Number(m[1])),
    0,
  );
  if (video && decodedFrames < 1)
    throw Error(
      "The converted file contains no decodable video frames. Export was stopped to avoid an audio-only result.",
    );
  if (
    video &&
    metadata.streams.some((s) => s.codec_type === "audio") &&
    !verified.streams.some((s) => s.codec_type === "audio")
  )
    throw Error(
      "The converted file lost the source audio track. Export was stopped.",
    );
  progress({ stage: "Conversion complete", percent: 100 });
  return output;
}
module.exports = { ensureEngine, convert, run };
