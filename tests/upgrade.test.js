import test from "node:test";
import assert from "node:assert/strict";
import { node, project, validateProject } from "../src/model.js";
import {
  vectorize,
  splitEdge,
  pathData,
  rangeSelection,
  localPoint,
} from "../src/vector.js";
import { shapeSVG, exportSVG } from "../src/render.js";
test("ellipse converts to cubic anchors and splits without breaking closure", () => {
  const n = node("ellipse");
  vectorize(n);
  assert.equal(n.vertices.length, 4);
  assert.ok(pathData(n).includes("C"));
  splitEdge(n, 0, 0.5);
  assert.equal(n.vertices.length, 5);
  assert.equal(n.closed, true);
  assert.ok(n.vertices[1].in);
  const p = project();
  p.pages[0].nodes = [n];
  validateProject(JSON.parse(JSON.stringify(p)));
});
test("range selection stays inside a group or promotes the crossed container", () => {
  const f = node("frame"),
    g = node("group", 0, 0, 100, 100, { parent: f.id }),
    a = node("rectangle", 0, 0, 10, 10, { parent: g.id }),
    b = node("ellipse", 10, 10, 10, 10, { parent: g.id }),
    root = node("text");
  const ns = [f, g, a, b, root];
  assert.deepEqual(rangeSelection(ns, a.id, b.id), new Set([b.id, a.id]));
  const crossed = rangeSelection(ns, root.id, b.id);
  for (const n of ns) assert.ok(crossed.has(n.id));
});
test("stacked fills reverse paint order, retain opacity, and export stroke position", () => {
  const n = node("rectangle", 0, 0, 100, 100, {
    fills: [
      { color: "#000000", opacity: 0.2, visible: true },
      { color: "#12cafd", opacity: 1, visible: true },
    ],
    strokes: [
      {
        color: "#ffffff",
        opacity: 0.5,
        width: 3,
        position: "inside",
        visible: true,
      },
    ],
  });
  const svg = shapeSVG(n);
  assert.ok(svg.indexOf('fill="#12cafd"') < svg.indexOf('fill="#000000"'));
  assert.ok(svg.includes('fill-opacity="0.2"'));
  assert.ok(svg.includes('stroke-width="6"'));
  assert.ok(svg.includes("clip-path="));
  assert.ok(exportSVG([n]).includes('fill="#12cafd"'));
});
test("rotated flipped vector pointer coordinates invert correctly", () => {
  const n = node("rectangle", 100, 100, 100, 100, { rotation: 90 });
  const p = localPoint(n, { x: 200, y: 100 });
  assert.ok(Math.abs(p.x) < 1e-10);
  assert.ok(Math.abs(p.y) < 1e-10);
});
test("malformed paints and vertices are rejected", () => {
  const p = project(),
    n = node("rectangle");
  vectorize(n);
  p.pages[0].nodes = [n];
  n.vertices[0].x = NaN;
  assert.throws(() => validateProject(p), /vector/);
  n.vertices[0].x = 0;
  n.fills = [{ color: "red", opacity: 1 }];
  assert.throws(() => validateProject(p), /paint/);
});
