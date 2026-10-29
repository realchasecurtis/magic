import test from "node:test";
import assert from "node:assert/strict";
import { node } from "../src/model.js";
import { vectorize, curvePoint, nearestEdge, bendEdge } from "../src/vector.js";
import { rasterPDF } from "../src/pdf-export.js";
import { tracePixels, removeEdgeBackground } from "../src/image-actions.js";
import { pathData, nextVertexIndex, splitEdge } from "../src/vector.js";
test("edge hit-test agrees with inserted point on a straight segment", () => {
  const n = node("rectangle", 0, 0, 200, 100);
  vectorize(n);
  const hit = nearestEdge(n, { x: 0.3, y: 0.01 });
  assert.equal(hit.i, 0);
  assert.ok(Math.abs(hit.q.x - 0.3) < 0.001);
  assert.ok(hit.d < 1.01);
});
test("dragging an edge bends it through the cursor without moving its anchors", () => {
  const n = node("rectangle");
  vectorize(n);
  const a = structuredClone(n.vertices[0]),
    b = structuredClone(n.vertices[1]);
  bendEdge(n, 0, 0.4, { x: 0, y: 0.3 }, { a, b });
  assert.equal(n.vertices[0].x, a.x);
  assert.equal(n.vertices[1].y, b.y);
  assert.ok(n.vertices[0].out);
  assert.ok(n.vertices[1].in);
  const q = curvePoint(n.vertices[0], n.vertices[1], 0.4);
  assert.ok(Math.abs(q.x - 0.4) < 1e-10);
  assert.ok(Math.abs(q.y - 0.3) < 1e-10);
});
test("PDF xref offsets point at each object and binary image data stays intact", () => {
  const jpeg = new Uint8Array([255, 216, 0, 10, 255, 0, 216, 255, 217]);
  const bytes = rasterPDF(200, 100, jpeg),
    text = new TextDecoder("latin1").decode(bytes);
  assert.ok(text.includes("/MediaBox [0 0 150 75]"));
  const start = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(new TextDecoder().decode(bytes.slice(start, start + 4)), "xref");
  const entries = text.slice(start).split("\n").slice(3, 8);
  entries.forEach((entry, i) => {
    const offset = Number(entry.slice(0, 10));
    assert.equal(
      new TextDecoder().decode(bytes.slice(offset, offset + 7)),
      `${i + 1} 0 obj`,
    );
  });
});
test("tracing yields native compound contours and retains holes", () => {
  const w = 7,
    h = 7,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 1; y < 6; y++)
    for (let x = 1; x < 6; x++) {
      if (x >= 2 && x <= 4 && y >= 2 && y <= 4) continue;
      const i = (y * w + x) * 4;
      data.set([18, 202, 253, 255], i);
    }
  const result = tracePixels(data, w, h);
  assert.equal(result.contours, 2);
  assert.equal(result.color, "#12cafd");
  const n = node("vector", 0, 0, 70, 70, {
    closed: true,
    vertices: result.vertices,
  });
  assert.equal((pathData(n).match(/M/g) || []).length, 2);
  const boundary = n.vertices.findIndex((p) => p.breakBefore);
  assert.equal(nextVertexIndex(n, boundary - 1), 0);
  const count = n.vertices.length;
  splitEdge(n, boundary - 1);
  assert.equal(n.vertices.length, count + 1);
  assert.equal((pathData(n).match(/M/g) || []).length, 2);
});
test("background removal only reaches border-connected pixels", () => {
  const w = 5,
    h = 5,
    data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const border = x === 0 || y === 0 || x === 4 || y === 4,
        center = x === 2 && y === 2;
      data.set(
        border || center ? [255, 255, 255, 255] : [0, 0, 0, 255],
        (y * w + x) * 4,
      );
    }
  const result = removeEdgeBackground(data, w, h, [255, 255, 255], 0);
  assert.equal(result.removed, 16);
  assert.equal(result.data[(2 * w + 2) * 4 + 3], 255);
  assert.equal(result.data[3], 0);
  assert.equal(data[3], 255);
});
