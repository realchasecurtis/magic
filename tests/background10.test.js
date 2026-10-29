import test from "node:test";
import assert from "node:assert/strict";
import { removeAutoBackground } from "../src/image-actions.js";
test("dominant border detection ignores a contaminated corner and protects a low-contrast object boundary", () => {
  const w = 30,
    h = 30,
    data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([100, 100, 100, 255], i * 4);
  data.set([0, 0, 0, 255], 0);
  for (let y = 8; y < 22; y++)
    for (let x = 8; x < 22; x++) data.set([80, 80, 80, 255], (y * w + x) * 4);
  const r = removeAutoBackground(data, w, h, 40);
  assert.equal(r.data[(15 * w + 15) * 4 + 3], 255);
  assert.equal(r.data[(2 * w + 2) * 4 + 3], 0);
  const keep = new Uint8Array(w * h);
  keep[2 * w + 2] = 1;
  assert.equal(
    removeAutoBackground(data, w, h, 40, keep).data[(2 * w + 2) * 4 + 3],
    255,
  );
});
