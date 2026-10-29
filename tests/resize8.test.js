import { resizeUpright } from "../src/resize.js";
import assert from "node:assert/strict";
import test from "node:test";
function box(n) {
  const a = (n.rotation * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a)),
    w = c * n.w + s * n.h,
    h = s * n.w + c * n.h;
  return { x: n.x + (n.w - w) / 2, y: n.y + (n.h - h) / 2, w, h };
}
test("rotated resize anchors top-left and tracks upright corner", () => {
  for (const rotation of [0, 20, 30, 60, 90, 120, 180, 270]) {
    const n = { x: 100, y: 80, w: 200, h: 130, rotation },
      a = box(n),
      next = { ...n, ...resizeUpright(n, 35, 25) },
      b = box(next);
    assert.ok(Math.abs(a.x - b.x) < 1e-7);
    assert.ok(Math.abs(a.y - b.y) < 1e-7);
    assert.ok(Math.abs(b.w - a.w - 35) < 1e-7);
    assert.ok(Math.abs(b.h - a.h - 25) < 1e-7);
  }
});
test("diagonal rotation and extreme drags remain finite and positive", () => {
  for (const rotation of [44, 45, 46, 135]) {
    const n = { x: 0, y: 0, w: 100, h: 160, rotation };
    for (const [x, y] of [
      [70, 20],
      [-500, 30],
      [0, 0],
    ]) {
      const next = resizeUpright(n, x, y);
      assert.ok(Object.values(next).every(Number.isFinite));
      assert.ok(next.w >= 5 && next.h >= 5);
    }
  }
});
