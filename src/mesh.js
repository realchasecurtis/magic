// Geometry-only mesh interchange. Original attachments are always retained.
export function readMesh(buffer, extension) {
  const text = new TextDecoder().decode(buffer),
    vertices = [],
    faces = [];
  if (extension === "obj") {
    for (const line of text.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === "v") vertices.push(parts.slice(1, 4).map(Number));
      if (parts[0] === "f") {
        const f = parts.slice(1).map((p) => {
          const i = Number(p.split("/")[0]);
          return i < 0 ? vertices.length + i : i - 1;
        });
        for (let i = 1; i < f.length - 1; i++)
          faces.push([f[0], f[i], f[i + 1]]);
      }
    }
  } else if (extension === "stl") {
    const view = new DataView(buffer),
      count = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
    if (count > 0 && 84 + count * 50 === buffer.byteLength) {
      for (let i = 0; i < count; i++) {
        const face = [];
        for (let j = 0; j < 3; j++) {
          const offset = 84 + i * 50 + 12 + j * 12;
          face.push(vertices.length);
          vertices.push(
            [0, 4, 8].map((k) => view.getFloat32(offset + k, true)),
          );
        }
        faces.push(face);
      }
    } else {
      for (const m of text.matchAll(
        /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g,
      ))
        vertices.push(m.slice(1).map(Number));
      for (let i = 0; i + 2 < vertices.length; i += 3)
        faces.push([i, i + 1, i + 2]);
    }
  } else
    throw Error(
      "Conversion currently reads OBJ and STL geometry. Download original preserves other formats.",
    );
  if (
    !faces.length ||
    vertices.some(
      (v) => v.length !== 3 || v.some((x) => !Number.isFinite(x)),
    ) ||
    faces.some((f) => f.some((i) => !Number.isInteger(i) || !vertices[i]))
  )
    throw Error("No valid triangle mesh found in this file.");
  return { vertices, faces };
}
export function writeMesh(mesh, format) {
  const { vertices: v, faces: f } = mesh;
  if (format === "OBJ")
    return (
      "# Magic geometry export\n" +
      v.map((p) => "v " + p.join(" ")).join("\n") +
      "\n" +
      f.map((p) => "f " + p.map((i) => i + 1).join(" ")).join("\n")
    );
  if (format === "PLY")
    return (
      `ply\nformat ascii 1.0\nelement vertex ${v.length}\nproperty float x\nproperty float y\nproperty float z\nelement face ${f.length}\nproperty list uchar int vertex_indices\nend_header\n` +
      v.map((p) => p.join(" ")).join("\n") +
      "\n" +
      f.map((p) => "3 " + p.join(" ")).join("\n")
    );
  if (format === "STL")
    return (
      "solid Magic\n" +
      f
        .map((face) => {
          const [a, b, c] = face.map((i) => v[i]),
            u = b.map((x, i) => x - a[i]),
            w = c.map((x, i) => x - a[i]),
            n = [
              u[1] * w[2] - u[2] * w[1],
              u[2] * w[0] - u[0] * w[2],
              u[0] * w[1] - u[1] * w[0],
            ],
            length = Math.hypot(...n) || 1;
          return (
            "facet normal " +
            n.map((x) => x / length).join(" ") +
            "\nouter loop\n" +
            [a, b, c].map((p) => "vertex " + p.join(" ")).join("\n") +
            "\nendloop\nendfacet"
          );
        })
        .join("\n") +
      "\nendsolid Magic"
    );
  throw Error("Unsupported mesh export format");
}
