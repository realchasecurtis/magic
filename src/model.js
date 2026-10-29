export const uid = () => globalThis.crypto.randomUUID();
export const clone = (value) =>
  Array.isArray(value)
    ? value.map(clone)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value).map(([key, v]) => [key, clone(v)]),
        )
      : value;
export function node(type, x = 0, y = 0, w = 180, h = 120, extra = {}) {
  return {
    id: uid(),
    type,
    name: type[0].toUpperCase() + type.slice(1),
    x,
    y,
    w,
    h,
    rotation: 0,
    fill: ["frame", "text"].includes(type) ? "#ffffff" : "#12cafd",
    stroke: "#0796b9",
    strokeWidth: type === "frame" ? 0 : 1,
    opacity: 1,
    hidden: false,
    locked: false,
    parent: null,
    ...extra,
  };
}
export function page(name = "Page 1") {
  return { id: uid(), name, nodes: [], view: { x: 70, y: 70, zoom: 1 } };
}
export function project(name = "Untitled project") {
  return { id: uid(), name, pages: [page()], activePage: null };
}
export function descendants(nodes, ids) {
  const result = new Set(ids);
  let change = true;
  while (change) {
    change = false;
    for (const n of nodes)
      if (result.has(n.parent) && !result.has(n.id)) {
        result.add(n.id);
        change = true;
      }
  }
  return result;
}
export function bounds(nodes) {
  if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(...nodes.map((n) => n.x)),
    y = Math.min(...nodes.map((n) => n.y));
  return {
    x,
    y,
    w: Math.max(...nodes.map((n) => n.x + n.w)) - x,
    h: Math.max(...nodes.map((n) => n.y + n.h)) - y,
  };
}
export function contains(a, b) {
  return (
    b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h
  );
}
export function validateProject(p) {
  if (
    !p ||
    typeof p.name !== "string" ||
    !Array.isArray(p.pages) ||
    !p.pages.length
  )
    throw Error("Invalid project");
  if (
    p.fonts !== undefined &&
    (!Array.isArray(p.fonts) ||
      p.fonts.some(
        (f) =>
          !f ||
          typeof f.name !== "string" ||
          typeof f.src !== "string" ||
          !/^data:font\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(f.src),
      ))
  )
    throw Error("Invalid embedded font");
  const ids = new Set();
  for (const page of p.pages) {
    if (
      typeof page.id !== "string" ||
      ids.has(page.id) ||
      typeof page.name !== "string" ||
      !Array.isArray(page.nodes)
    )
      throw Error("Invalid page");
    ids.add(page.id);
    const map = new Map();
    for (const n of page.nodes) {
      if (
        typeof n.id !== "string" ||
        map.has(n.id) ||
        ![
          "frame",
          "group",
          "rectangle",
          "triangle",
          "vector",
          "ellipse",
          "polygon",
          "star",
          "line",
          "arrow",
          "pen",
          "pencil",
          "text",
          "image",
          "pdf",
          "video",
          "audio",
          "file",
          "comment",
        ].includes(n.type)
      )
        throw Error("Invalid layer");
      for (const key of [
        "x",
        "y",
        "w",
        "h",
        "rotation",
        "opacity",
        "strokeWidth",
      ])
        if (!Number.isFinite(n[key])) throw Error("Invalid layer geometry");
      if (n.w <= 0 || n.h <= 0) throw Error("Invalid dimensions");
      if (n.src && !/^data:[^,]*[;,]/.test(n.src))
        throw Error("Only embedded assets are supported");
      if (
        n.type === "vector" &&
        (!Array.isArray(n.vertices) ||
          n.vertices.length < 2 ||
          n.vertices.some(
            (p) =>
              !Number.isFinite(p.x) ||
              !Number.isFinite(p.y) ||
              ["in", "out"].some(
                (k) =>
                  p[k] &&
                  (!Number.isFinite(p[k].x) || !Number.isFinite(p[k].y)),
              ),
          ))
      )
        throw Error("Invalid vector path");
      for (const kind of ["fills", "strokes"])
        if (
          n[kind] &&
          (!Array.isArray(n[kind]) ||
            n[kind].some(
              (p) =>
                !/^#[0-9a-f]{6}$/i.test(p.color) ||
                !Number.isFinite(p.opacity) ||
                p.opacity < 0 ||
                p.opacity > 1 ||
                (kind === "strokes" &&
                  (!Number.isFinite(p.width) ||
                    p.width < 0 ||
                    !["inside", "center", "outside"].includes(p.position))),
            ))
        )
          throw Error("Invalid paint");
      map.set(n.id, n);
    }
    for (const n of page.nodes) {
      let current = n,
        seen = new Set();
      while (current.parent) {
        if (seen.has(current.id)) throw Error("Cyclic hierarchy");
        seen.add(current.id);
        current = map.get(current.parent);
        if (!current || !["frame", "group"].includes(current.type))
          throw Error("Invalid parent");
      }
    }
  }
  return p;
}
export function copyNodes(nodes, ids, offset = 24) {
  const selected = descendants(nodes, ids);
  const copies = clone(nodes.filter((n) => selected.has(n.id)));
  const mapping = new Map(copies.map((n) => [n.id, uid()]));
  for (const n of copies) {
    n.id = mapping.get(n.id);
    n.parent = mapping.get(n.parent) || null;
    n.x += offset;
    n.y += offset;
  }
  return copies;
}
export function starter() {
  const p = project("The creative playground");
  const pg = p.pages[0];
  pg.name = "Getting started";
  const frame = node("frame", 80, 70, 680, 440, {
    name: "01 / A little room for possibility",
    fill: "#fffdf8",
  });
  pg.nodes.push(
    frame,
    node("text", 120, 110, 500, 20, {
      parent: frame.id,
      text: "M A G I C   /   Y O U R   C R E A T I V E   W O R K S P A C E",
      fontSize: 10,
      fill: "#96839f",
      name: "Eyebrow",
    }),
    node("text", 120, 161, 550, 125, {
      parent: frame.id,
      text: "A little space.\nEndless possibilities.",
      fontSize: 46,
      fontWeight: "600",
      fill: "#40304f",
      name: "Welcome headline",
    }),
    node("text", 123, 308, 365, 75, {
      parent: frame.id,
      text: "Bring your files, shape an idea, make something yours. Everything starts on this canvas.",
      fontSize: 16,
      fill: "#9c8fa5",
      name: "Introduction",
    }),
    node("rectangle", 123, 419, 176, 42, {
      parent: frame.id,
      fill: "#00bfe8",
      strokeWidth: 0,
      radius: 10,
      name: "Button background",
    }),
    node("text", 144, 430, 140, 24, {
      parent: frame.id,
      text: "Make a little magic ↗",
      fontSize: 13,
      fill: "#ffffff",
      name: "Button label",
    }),
    node("star", 567, 324, 125, 125, {
      parent: frame.id,
      fill: "#8be6fa",
      strokeWidth: 0,
      rotation: 12,
      name: "Spark",
    }),
    node("text", 100, 560, 550, 26, {
      text: "A home for your ideas. A toolkit that grows with you.",
      fontSize: 14,
      fill: "#a598ae",
      name: "Canvas note",
    }),
  );
  return p;
}
