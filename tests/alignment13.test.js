import test from "node:test";
import assert from "node:assert/strict";
import { snapBounds, duplicateOffset } from "../src/alignment.js";
test("snapping is zoom-aware and Alt bypasses correction", () => {
  const b = { x: 103, y: 80, w: 100, h: 90 },
    t = [{ x: 100, y: 300, w: 100, h: 90 }];
  assert.equal(snapBounds(b, t, 1).dx, -3);
  assert.equal(snapBounds(b, t, 2).dx, 0);
  assert.equal(snapBounds(b, t, 1, false, true).dx, 0);
  assert.ok(snapBounds(b, t, 1).lines.length);
});
test("duplicates clear successive obstacles with ten pixel gaps", () => {
  const b = { x: 0, y: 0, w: 100, h: 80 };
  assert.equal(duplicateOffset(b, []), 110);
  assert.equal(
    duplicateOffset(b, [
      { x: 110, y: 0, w: 100, h: 80 },
      { x: 220, y: 0, w: 200, h: 80 },
    ]),
    430,
  );
});
