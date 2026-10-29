const exportFonts = new Map();
export function registerExportFont(name, src) {
  exportFonts.set(name, src);
}
import { textLines } from "./text-layout.js";
import { pathData } from "./vector.js";
export const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function paints(n, kind) {
  return (
    n[kind] ??
    (kind === "fills"
      ? n.fill && n.fill !== "none"
        ? [{ color: n.fill, opacity: 1, visible: true }]
        : []
      : n.strokeWidth > 0
        ? [
            {
              color: n.stroke,
              opacity: 1,
              visible: true,
              width: n.strokeWidth,
              position: "center",
            },
          ]
        : [])
  );
}
function geometry(n, attrs) {
  const w = n.w,
    h = n.h;
  if (n.type === "vector")
    return `<path d="${pathData(n)}" fill-rule="evenodd" clip-rule="evenodd" ${attrs}/>`;
  if (n.type === "text")
    return `<text ${attrs} font-family="${escape(n.fontFamily || "Arial")}" font-size="${n.fontSize || 24}" font-weight="${escape(n.fontWeight || "400")}">${textLines(
      n,
    )
      .map(
        (line, i) =>
          `<tspan text-anchor="${n.align === "center" ? "middle" : n.align === "right" ? "end" : "start"}" x="${n.align === "center" ? w / 2 : n.align === "right" ? w : 0}" y="${(n.fontSize || 24) * (1 + i * 1.2)}">${escape(line)}</tspan>`,
      )
      .join("")}</text>`;
  if (n.type === "ellipse")
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${attrs}/>`;
  if (["triangle", "polygon", "star"].includes(n.type)) {
    const count = n.type === "triangle" ? 3 : n.type === "star" ? 10 : 6;
    return `<polygon points="${Array.from({ length: count }, (_, i) => {
      const r = n.type === "star" && i % 2 ? 0.45 : 1,
        a = (i * Math.PI * 2) / count - Math.PI / 2;
      return `${w / 2 + ((Math.cos(a) * w) / 2) * r},${h / 2 + ((Math.sin(a) * h) / 2) * r}`;
    }).join(" ")}" ${attrs}/>`;
  }
  if (["line", "arrow"].includes(n.type))
    return `<path d="M0 ${h} L${w} 0 ${n.type === "arrow" ? `M${w - 15} 0 L${w} 0 L${w} 15` : ""}" ${attrs}/>`;
  if (["pen", "pencil"].includes(n.type))
    return `<polyline points="${(n.points || []).map((p) => `${p[0] * w},${p[1] * h}`).join(" ")}" ${attrs}/>`;
  return `<rect width="${w}" height="${h}" rx="${n.radius || 0}" ${attrs}/>`;
}
export function shapeSVG(n) {
  const id = "p" + n.id.replace(/[^a-z0-9]/gi, ""),
    closed =
      !["line", "arrow", "pen", "pencil"].includes(n.type) &&
      (n.type !== "vector" || n.closed);
  let s = "";
  for (const p of [...paints(n, "fills")].reverse())
    if (p.visible !== false)
      s += geometry(
        n,
        `fill="${escape(p.color)}" fill-opacity="${p.opacity}" stroke="none"`,
      );
  s += `<defs><clipPath id="${id}-clip">${geometry(n, 'fill="white" stroke="none"')}</clipPath><mask id="${id}-outside" maskUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000"><rect x="-10000" y="-10000" width="20000" height="20000" fill="white"/>${geometry(n, 'fill="black" stroke="none"')}</mask></defs>`;
  for (const p of [...paints(n, "strokes")].reverse())
    if (p.visible !== false) {
      const position = closed ? p.position : "center",
        width =
          p.width * (position === "inside" || position === "outside" ? 2 : 1);
      s += geometry(
        n,
        `fill="none" stroke="${escape(p.color)}" stroke-opacity="${p.opacity}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${position === "inside" ? `clip-path="url(#${id}-clip)"` : position === "outside" ? `mask="url(#${id}-outside)"` : ""}`,
      );
    }
  return s;
}
export function exportSVG(nodes) {
  const fontStyles = [
    ...new Set(nodes.filter((n) => n.type === "text").map((n) => n.fontFamily)),
  ]
    .filter((name) => exportFonts.has(name))
    .map(
      (name) =>
        `@font-face{font-family:${JSON.stringify(name)};src:url("${exportFonts.get(name)}");font-weight:100 900;}`,
    )
    .join("");
  const visible = nodes.filter(
    (n) =>
      !n.hidden &&
      !["comment", "group", "pdf", "audio", "video", "file"].includes(n.type),
  );
  const x = Math.min(
      ...visible.map((n) => n.x),
      ...(visible.length ? [] : [0]),
    ),
    y = Math.min(...visible.map((n) => n.y), ...(visible.length ? [] : [0])),
    w = Math.max(1, ...visible.map((n) => n.x + n.w - x)),
    h = Math.max(1, ...visible.map((n) => n.y + n.h - y));
  let body =
    '<defs><filter id="magic-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity=".2"/></filter></defs>';
  for (const n of visible) {
    const content =
      n.type === "image"
        ? `<image href="${escape(n.src)}" width="${n.w}" height="${n.h}"/>`
        : shapeSVG(n);
    body += `<g ${n.shadow ? 'filter="url(#magic-shadow)"' : ""} opacity="${n.opacity}" transform="translate(${n.x} ${n.y}) rotate(${n.rotation} ${n.w / 2} ${n.h / 2}) translate(${n.flipX ? n.w : 0} ${n.flipY ? n.h : 0}) scale(${n.flipX ? -1 : 1} ${n.flipY ? -1 : 1})">${content}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><defs><style>${escape(fontStyles)}</style></defs>${body}</svg>`;
}
