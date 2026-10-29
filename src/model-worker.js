importScripts("../vendor/assimp/assimpjs.js");
onmessage = async ({ data: { files, format } }) => {
  let list, result;
  try {
    const a = await assimpjs({
      locateFile: (path) =>
        new URL("../vendor/assimp/" + path, self.location.href).href,
    });
    list = new a.FileList();
    for (const file of files) list.AddFile(file.name, file.bytes);
    result = a.ConvertFileList(list, format === "GLB" ? "glb2" : "assjson");
    if (!result.IsSuccess() || !result.FileCount())
      throw Error(
        "Could not convert this model (" +
          result.GetErrorCode() +
          "). Include any companion files on this page.",
      );
    if (format === "GLB") {
      const file = result.GetFile(0);
      postMessage({ bytes: new Uint8Array(file.GetContent()) });
    } else {
      const scene = JSON.parse(
          new TextDecoder().decode(result.GetFile(0).GetContent()),
        ),
        { sceneMesh, writeFBX } = await import("./scene-mesh.js"),
        { writeMesh } = await import("./mesh.js"),
        mesh = sceneMesh(scene);
      postMessage({
        text: format === "FBX" ? writeFBX(mesh) : writeMesh(mesh, format),
      });
    }
  } catch (e) {
    postMessage({ error: e.message });
  } finally {
    result?.delete?.();
    list?.delete?.();
  }
};
