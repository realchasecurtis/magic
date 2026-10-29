export const editableTypes = new Set([
  "rectangle",
  "ellipse",
  "triangle",
  "polygon",
  "star",
  "line",
  "arrow",
  "pen",
  "pencil",
  "vector",
]);
// Rebase the editable path while keeping its transformed world-space position.
export function normalizeVector(n) {
  const points = n.vertices.flatMap((p) => [
    p,
    ...(p.in ? [p.in] : []),
    ...(p.out ? [p.out] : []),
  ]);
  if (!points.length) return;
  const minX = Math.min(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y));
  const sx = Math.max(1 / n.w, Math.max(...points.map((p) => p.x)) - minX),
    sy = Math.max(1 / n.h, Math.max(...points.map((p) => p.y)) - minY);
  const dx = (minX + sx / 2 - 0.5) * n.w * (n.flipX ? -1 : 1),
    dy = (minY + sy / 2 - 0.5) * n.h * (n.flipY ? -1 : 1),
    angle = (n.rotation * Math.PI) / 180;
  const w = n.w * sx,
    h = n.h * sy;
  n.x += n.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle) - w / 2;
  n.y += n.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) - h / 2;
  n.w = w;
  n.h = h;
  for (const p of points) {
    p.x = (p.x - minX) / sx;
    p.y = (p.y - minY) / sy;
  }
}
const point = (x, y, extra = {}) => ({ x, y, ...extra });
export function vectorize(n) {
  if (n.type === "vector") return;
  let vertices = [],
    closed = true;
  if (n.type === "ellipse") {
    const k = 0.2761423749;
    vertices = [
      point(0.5, 0, { in: point(0.5 - k, 0), out: point(0.5 + k, 0) }),
      point(1, 0.5, { in: point(1, 0.5 - k), out: point(1, 0.5 + k) }),
      point(0.5, 1, { in: point(0.5 + k, 1), out: point(0.5 - k, 1) }),
      point(0, 0.5, { in: point(0, 0.5 + k), out: point(0, 0.5 - k) }),
    ];
  } else if (["triangle", "polygon", "star"].includes(n.type)) {
    const count = n.type === "triangle" ? 3 : n.type === "star" ? 10 : 6;
    vertices = Array.from({ length: count }, (_, i) => {
      const r = n.type === "star" && i % 2 ? 0.45 : 1,
        a = (i * Math.PI * 2) / count - Math.PI / 2;
      return point(0.5 + Math.cos(a) * 0.5 * r, 0.5 + Math.sin(a) * 0.5 * r);
    });
  } else if (["pen", "pencil"].includes(n.type)) {
    vertices = (n.points || []).map(([x, y]) => point(x, y));
    closed = false;
  } else if (n.type === "line") {
    vertices = [point(0, 1), point(1, 0)];
    closed = false;
  } else if (n.type === "arrow") {
    vertices = [
      point(0, 1),
      point(1, 0),
      point(Math.max(0, 1 - 15 / n.w), 0),
      point(1, 0),
      point(1, Math.min(1, 15 / n.h)),
    ];
    closed = false;
  } else {
    const rx = Math.min(n.radius || 0, n.w / 2, n.h / 2) / n.w,
      ry = Math.min(n.radius || 0, n.w / 2, n.h / 2) / n.h,
      k = 0.5522847498;
    if (rx && ry)
      vertices = [
        point(rx, 0, { in: point(rx - rx * k, 0) }),
        point(1 - rx, 0, { out: point(1 - rx + rx * k, 0) }),
        point(1, ry, { in: point(1, ry - ry * k) }),
        point(1, 1 - ry, { out: point(1, 1 - ry + ry * k) }),
        point(1 - rx, 1, { in: point(1 - rx + rx * k, 1) }),
        point(rx, 1, { out: point(rx - rx * k, 1) }),
        point(0, 1 - ry, { in: point(0, 1 - ry + ry * k) }),
        point(0, ry, { out: point(0, ry - ry * k) }),
      ];
    else vertices = [point(0, 0), point(1, 0), point(1, 1), point(0, 1)];
  }
  n.originalType = n.type;
  n.type = "vector";
  n.vertices = vertices;
  n.closed = closed;
}
export function pathData(n) {
  const vs = n.vertices || [];
  if (!vs.length) return "";
  const xy = (p) => `${p.x * n.w} ${p.y * n.h}`;
  let d = "";
  for (let i = 0; i < vs.length; i++) {
    if (i === 0 || vs[i].breakBefore) d += ` M${xy(vs[i])}`;
    const next = nextVertexIndex(n, i);
    if (next === null) continue;
    const a = vs[i],
      b = vs[next];
    d +=
      a.out || b.in
        ? ` C${xy(a.out || a)} ${xy(b.in || b)} ${xy(b)}`
        : ` L${xy(b)}`;
    if (next <= i) d += " Z";
  }
  return d.trim();
}
export function nextVertexIndex(n, i) {
  if (i + 1 < n.vertices.length && !n.vertices[i + 1].breakBefore) return i + 1;
  if (!n.closed) return null;
  while (i > 0 && !n.vertices[i].breakBefore) i--;
  return i;
}
export function removeVertex(n, index) {
  let start = index,
    end = index + 1;
  while (start > 0 && !n.vertices[start].breakBefore) start--;
  while (end < n.vertices.length && !n.vertices[end].breakBefore) end++;
  if (end - start <= (n.closed ? 3 : 2)) return false;
  const starts = n.vertices[index].breakBefore;
  n.vertices.splice(index, 1);
  if (starts && n.vertices[index]) n.vertices[index].breakBefore = true;
  return true;
}
const lerp = (a, b, t) => point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export function curvePoint(a, b, t) {
  if (!a.out && !b.in) return lerp(a, b, t);
  return lerp(
    lerp(lerp(a, a.out || a, t), lerp(a.out || a, b.in || b, t), t),
    lerp(lerp(a.out || a, b.in || b, t), lerp(b.in || b, b, t), t),
    t,
  );
}
export function nearestEdge(n, local, zoom = 1) {
  let best = null;
  const count = n.closed ? n.vertices.length : n.vertices.length - 1;
  const distance = (i, t) => {
    const q = curvePoint(n.vertices[i], n.vertices[nextVertexIndex(n, i)], t);
    return {
      i,
      t,
      q,
      d: Math.hypot((q.x - local.x) * n.w, (q.y - local.y) * n.h) * zoom,
    };
  };
  for (let i = 0; i < count; i++)
    for (let step = 1; step < 50; step++) {
      if (nextVertexIndex(n, i) === null) continue;
      const candidate = distance(i, step / 50);
      if (!best || candidate.d < best.d) best = candidate;
    }
  if (!best) return null;
  let lo = Math.max(0.001, best.t - 0.02),
    hi = Math.min(0.999, best.t + 0.02);
  for (let step = 0; step < 12; step++) {
    const a = lo + (hi - lo) / 3,
      b = hi - (hi - lo) / 3;
    if (distance(best.i, a).d < distance(best.i, b).d) hi = b;
    else lo = a;
  }
  return distance(best.i, (lo + hi) / 2);
}
export function bendEdge(n, index, t, delta, original) {
  const a = n.vertices[index],
    b = n.vertices[nextVertexIndex(n, index)];
  const start = original || { a: structuredClone(a), b: structuredClone(b) };
  const curved = start.a.out || start.b.in;
  const c1 = start.a.out || (curved ? start.a : lerp(start.a, start.b, 1 / 3)),
    c2 = start.b.in || (curved ? start.b : lerp(start.a, start.b, 2 / 3));
  t = Math.max(0.05, Math.min(0.95, t));
  const w1 = 3 * (1 - t) * (1 - t) * t,
    w2 = 3 * (1 - t) * t * t,
    denom = w1 * w1 + w2 * w2;
  a.out = point(c1.x + (delta.x * w1) / denom, c1.y + (delta.y * w1) / denom);
  b.in = point(c2.x + (delta.x * w2) / denom, c2.y + (delta.y * w2) / denom);
}
export function splitEdge(n, index, t = 0.5) {
  const a = n.vertices[index],
    b = n.vertices[nextVertexIndex(n, index)];
  let p;
  if (a.out || b.in) {
    const ab = lerp(a, a.out || a, t),
      bc = lerp(a.out || a, b.in || b, t),
      cd = lerp(b.in || b, b, t),
      abc = lerp(ab, bc, t),
      bcd = lerp(bc, cd, t);
    p = lerp(abc, bcd, t);
    a.out = ab;
    b.in = cd;
    p.in = abc;
    p.out = bcd;
  } else p = lerp(a, b, t);
  n.vertices.splice(index + 1, 0, p);
  return index + 1;
}
export function localPoint(n, p) {
  const angle = (-n.rotation * Math.PI) / 180,
    dx = p.x - n.x - n.w / 2,
    dy = p.y - n.y - n.h / 2;
  return {
    x:
      ((dx * Math.cos(angle) - dy * Math.sin(angle)) * (n.flipX ? -1 : 1) +
        n.w / 2) /
      n.w,
    y:
      ((dx * Math.sin(angle) + dy * Math.cos(angle)) * (n.flipY ? -1 : 1) +
        n.h / 2) /
      n.h,
  };
}
export function rangeSelection(nodes, anchor, target) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  if (!map.has(anchor) || !map.has(target)) return new Set([target]);
  const lineage = (id) => {
    const result = [];
    for (let n = map.get(id); n; n = map.get(n.parent)) result.unshift(n.id);
    return result;
  };
  const a = lineage(anchor),
    b = lineage(target);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length || i === b.length) {
    const root = i === a.length ? anchor : target;
    return expand(nodes, [root]);
  }
  const parent = i ? a[i - 1] : null,
    siblings = nodes
      .filter((n) => n.parent === parent)
      .slice()
      .reverse(),
    ai = siblings.findIndex((n) => n.id === a[i]),
    bi = siblings.findIndex((n) => n.id === b[i]);
  return expand(
    nodes,
    siblings.slice(Math.min(ai, bi), Math.max(ai, bi) + 1).map((n) => n.id),
  );
}
function expand(nodes, ids) {
  const set = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes)
      if (set.has(n.parent) && !set.has(n.id)) {
        set.add(n.id);
        changed = true;
      }
  }
  return set;
}
