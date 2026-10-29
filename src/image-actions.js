import { fitContour } from "./curve-fit.js";
// Boundary tracing produces actual editable closed contours, not an embedded SVG image.
export function tracePixels(data, w, h, threshold = 128, mode = "auto") {
  const mask = new Uint8Array(w * h);
  let transparent = 0;
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 128) transparent++;
  const alpha =
    mode === "alpha" || (mode === "auto" && transparent > w * h * 0.02);
  let count = 0,
    r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < mask.length; i++) {
    const k = i * 4;
    mask[i] =
      data[k + 3] > (alpha ? threshold : 127) &&
      (alpha ||
        data[k] * 0.2126 + data[k + 1] * 0.7152 + data[k + 2] * 0.0722 <
          threshold)
        ? 1
        : 0;
    if (mask[i]) {
      count++;
      r += data[k];
      g += data[k + 1];
      b += data[k + 2];
    }
  }
  if (!count)
    throw Error("No foreground found. Adjust the threshold or mask mode.");
  const edges = [],
    starts = new Map(),
    key = (x, y) => y * (w + 1) + x;
  function edge(x, y, xx, yy, dir) {
    const id = edges.length,
      e = { x, y, xx, yy, dir, used: false };
    edges.push(e);
    const k = key(x, y);
    if (!starts.has(k)) starts.set(k, []);
    starts.get(k).push(id);
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (on(x, y)) {
        if (!on(x, y - 1)) edge(x, y, x + 1, y, 0);
        if (!on(x + 1, y)) edge(x + 1, y, x + 1, y + 1, 1);
        if (!on(x, y + 1)) edge(x + 1, y + 1, x, y + 1, 2);
        if (!on(x - 1, y)) edge(x, y + 1, x, y, 3);
      }
  const vertices = [];
  for (const first of edges) {
    if (first.used) continue;
    const points = [];
    let e = first;
    while (e && !e.used) {
      e.used = true;
      points.push({ x: e.x, y: e.y });
      if (e.xx === first.x && e.yy === first.y) break;
      const candidates = (starts.get(key(e.xx, e.yy)) || [])
        .map((id) => edges[id])
        .filter((v) => !v.used);
      const rank = (d) => ({ 1: 0, 0: 1, 3: 2, 2: 3 })[(d - e.dir + 4) % 4];
      candidates.sort((a, b) => rank(a.dir) - rank(b.dir));
      e = candidates[0];
    }
    const corners = points.filter((p, i) => {
      const a = points[(i + points.length - 1) % points.length],
        b = points[(i + 1) % points.length];
      return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
    });
    const simple = corners.length <= 4 ? corners : fitContour(points);
    if (simple.length >= 3) {
      for (let i = 0; i < simple.length; i++)
        vertices.push({
          x: simple[i].x / w,
          y: simple[i].y / h,
          ...(simple[i].in
            ? { in: { x: simple[i].in.x / w, y: simple[i].in.y / h } }
            : {}),
          ...(simple[i].out
            ? { out: { x: simple[i].out.x / w, y: simple[i].out.y / h } }
            : {}),
          ...(i === 0 && vertices.length ? { breakBefore: true } : {}),
        });
    }
  }
  const color =
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(v / count)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  return {
    vertices,
    color,
    contours: vertices.filter((v) => v.breakBefore).length + 1,
  };
}
export function removeEdgeBackground(data, w, h, color, tolerance) {
  const out = new Uint8ClampedArray(data),
    seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let head = 0,
    tail = 0,
    removed = 0;
  const offer = (i) => {
    if (seen[i]) return;
    seen[i] = 1;
    const k = i * 4;
    if (
      data[k + 3] === 0 ||
      Math.max(
        Math.abs(data[k] - color[0]),
        Math.abs(data[k + 1] - color[1]),
        Math.abs(data[k + 2] - color[2]),
      ) <= tolerance
    )
      queue[tail++] = i;
  };
  for (let x = 0; x < w; x++) {
    offer(x);
    offer((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    offer(y * w);
    offer(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++],
      x = i % w,
      y = Math.floor(i / w);
    if (out[i * 4 + 3]) removed++;
    out[i * 4 + 3] = 0;
    if (x) offer(i - 1);
    if (x < w - 1) offer(i + 1);
    if (y) offer(i - w);
    if (y < h - 1) offer(i + w);
  }
  return { data: out, removed };
}
// Estimate the dominant border color; stop region growth at strong object edges.
export function removeAutoBackground(
  data,
  w,
  h,
  tolerance,
  keep = new Uint8Array(w * h),
) {
  const bins = new Map(),
    border = [];
  for (let x = 0; x < w; x++) {
    border.push(x, (h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    border.push(y * w, y * w + w - 1);
  }
  for (const i of border) {
    const k = i * 4;
    if (data[k + 3] < 16) continue;
    const key = [0, 1, 2].map((j) => Math.floor(data[k + j] / 24)).join(",");
    let b = bins.get(key);
    if (!b) {
      b = { count: 0, sum: [0, 0, 0] };
      bins.set(key, b);
    }
    b.count++;
    for (let j = 0; j < 3; j++) b.sum[j] += data[k + j];
  }
  const best = [...bins.values()].sort((a, b) => b.count - a.count)[0],
    color = best ? best.sum.map((v) => v / best.count) : [255, 255, 255];
  const out = new Uint8ClampedArray(data),
    seen = new Uint8Array(w * h),
    queue = new Int32Array(w * h);
  let head = 0,
    tail = 0,
    removed = 0;
  const distance = (i, j) =>
    Math.max(
      ...[0, 1, 2].map((c) => Math.abs(data[i * 4 + c] - data[j * 4 + c])),
    );
  const offer = (i, from = -1) => {
    if (seen[i] || keep[i]) return;
    const k = i * 4,
      transparent = data[k + 3] === 0;
    if (
      !transparent &&
      Math.max(...color.map((v, j) => Math.abs(data[k + j] - v))) > tolerance
    )
      return;
    if (
      !transparent &&
      from >= 0 &&
      distance(i, from) > Math.min(28, 8 + tolerance * 0.18)
    )
      return;
    seen[i] = 1;
    queue[tail++] = i;
  };
  for (const i of border) offer(i);
  while (head < tail) {
    const i = queue[head++],
      x = i % w,
      y = Math.floor(i / w);
    if (out[i * 4 + 3]) removed++;
    out[i * 4 + 3] = 0;
    if (x) offer(i - 1, i);
    if (x < w - 1) offer(i + 1, i);
    if (y) offer(i - w, i);
    if (y < h - 1) offer(i + w, i);
  }
  return { data: out, removed };
}
