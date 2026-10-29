import test from "node:test";
import assert from "node:assert/strict";
import { tracePixels } from "../src/image-actions.js";
import { readMesh, writeMesh } from "../src/mesh.js";
test("curved silhouette becomes compact editable cubic contours", () => {
  const w = 256,
    data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++)
      if (Math.hypot(x - 128, y - 128) < 100) {
        data[(y * w + x) * 4 + 3] = 255;
      }
  const result = tracePixels(data, w, w);
  assert.ok(result.vertices.length < 80);
  assert.ok(result.vertices.some((p) => p.in && p.out));
});
test("OBJ to STL roundtrip preserves triangles and coordinates", () => {
  const buffer = new TextEncoder().encode(
      "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3",
    ).buffer,
    mesh = readMesh(buffer, "obj");
  const stl = writeMesh(mesh, "STL");
  const result = readMesh(new TextEncoder().encode(stl).buffer, "stl");
  assert.deepEqual(result.vertices, mesh.vertices);
  assert.deepEqual(result.faces, mesh.faces);
  assert.match(writeMesh(mesh, "PLY"), /element face 1/);
  assert.throws(() =>
    readMesh(new TextEncoder().encode("v 0 0 0\nf 1 2 99").buffer, "obj"),
  );
});
