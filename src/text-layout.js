let context;
function measure(text, n) {
  if (typeof document !== "undefined") {
    context ??= document.createElement("canvas").getContext("2d");
    context.font = `${n.fontWeight || 400} ${n.fontSize || 24}px ${n.fontFamily || "Arial"}`;
    return context.measureText(text).width;
  }
  return [...text].length * (n.fontSize || 24) * 0.6;
}
export function textLines(n, width = n.w) {
  const lines = [];
  for (const paragraph of String(n.text || "").split("\n")) {
    let line = "";
    for (const token of paragraph.split(/(\s+)/)) {
      if (!token) continue;
      if (measure(line + token, n) <= width) {
        line += token;
        continue;
      }
      if (line.trim()) {
        lines.push(line.trimEnd());
        line = "";
      }
      if (/^\s+$/.test(token)) continue;
      for (const char of token) {
        if (line && measure(line + char, n) > width) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export function fitText(n, axis = "w") {
  if (n.type !== "text") return;
  const size = n.fontSize || 24,
    lh = size * 1.2;
  n.w = Math.max(n.w, measure("W", n));
  if (axis === "h") {
    const count = Math.max(
      String(n.text || "").split("\n").length,
      Math.floor(n.h / lh),
      1,
    );
    let low = n.w,
      high =
        Math.max(
          n.w,
          ...String(n.text || "")
            .split("\n")
            .map((t) => measure(t, n)),
        ) + 1;
    if (textLines(n).length > count) {
      for (let i = 0; i < 20; i++) {
        const mid = (low + high) / 2;
        if (textLines(n, mid).length > count) low = mid;
        else high = mid;
      }
      n.w = Math.ceil(high);
    }
  }
  n.h = Math.max(n.h, textLines(n).length * lh);
}
