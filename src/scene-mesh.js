export function sceneMesh(scene) {
  const vertices = [],
    faces = [],
    identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    multiply = (a, b) =>
      a.map((_, i) => {
        const r = Math.floor(i / 4),
          c = i % 4;
        return (
          a[r * 4] * b[c] +
          a[r * 4 + 1] * b[4 + c] +
          a[r * 4 + 2] * b[8 + c] +
          a[r * 4 + 3] * b[12 + c]
        );
      });
  function walk(node, parent) {
    const m = multiply(parent, node.transformation || identity);
    for (const id of node.meshes || []) {
      const mesh = scene.meshes[id],
        base = vertices.length;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const [x, y, z] = mesh.vertices.slice(i, i + 3);
        vertices.push([
          m[0] * x + m[1] * y + m[2] * z + m[3],
          m[4] * x + m[5] * y + m[6] * z + m[7],
          m[8] * x + m[9] * y + m[10] * z + m[11],
        ]);
      }
      for (const f of mesh.faces || [])
        for (let i = 1; i < f.length - 1; i++)
          faces.push([base + f[0], base + f[i], base + f[i + 1]]);
    }
    for (const child of node.children || []) walk(child, m);
  }
  walk(scene.rootnode, identity);
  if (!faces.length) throw Error("The model has no polygon mesh to export.");
  return { vertices, faces };
}
export function writeFBX({ vertices, faces }) {
  return `; FBX 7.4.0 project file\nFBXHeaderExtension:  {\n FBXHeaderVersion: 1003\n FBXVersion: 7400\n Creator: "Magic"\n}\nGlobalSettings:  {\n Version: 1000\n Properties70:  {\n P: "UpAxis", "int", "Integer", "",1\n P: "UpAxisSign", "int", "Integer", "",1\n P: "FrontAxis", "int", "Integer", "",2\n P: "FrontAxisSign", "int", "Integer", "",-1\n P: "CoordAxis", "int", "Integer", "",0\n P: "CoordAxisSign", "int", "Integer", "",1\n P: "UnitScaleFactor", "double", "Number", "",1\n }\n}\nDefinitions:  {\n Version: 100\n Count: 2\n ObjectType: "Geometry" {\n Count: 1\n }\n ObjectType: "Model" {\n Count: 1\n }\n}\nObjects:  {\n Geometry: 1001, "Geometry::Magic", "Mesh" {\n Vertices: *${vertices.length * 3} {\n a: ${vertices.flat().join(",")}\n }\n PolygonVertexIndex: *${faces.length * 3} {\n a: ${faces.flatMap((f) => [f[0], f[1], -f[2] - 1]).join(",")}\n }\n GeometryVersion: 124\n }\n Model: 1002, "Model::Magic", "Mesh" {\n Version: 232\n Properties70:  {\n P: "Lcl Translation", "Lcl Translation", "", "A",0,0,0\n P: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0\n P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1\n }\n Shading: T\n Culling: "CullingOff"\n }\n}\nConnections:  {\n C: "OO",1001,1002\n C: "OO",1002,0\n}\n`;
}
