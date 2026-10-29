export function snapBounds(
  box,
  targets,
  zoom = 1,
  resize = false,
  bypass = false,
) {
  let dx = 0,
    dy = 0;
  const lines = [],
    tolerance = 5 / zoom;
  for (const axis of ["x", "y"]) {
    const size = axis === "x" ? "w" : "h",
      other = axis === "x" ? "y" : "x",
      otherSize = axis === "x" ? "h" : "w";
    const anchors = resize
      ? [box[axis] + box[size]]
      : [box[axis], box[axis] + box[size] / 2, box[axis] + box[size]];
    let best = null;
    for (const t of targets) {
      for (const v of [
        t[axis],
        t[axis] + t[size] / 2,
        t[axis] + t[size],
        ...(resize ? [box[axis] + t[size]] : []),
      ])
        for (const a of anchors) {
          const delta = v - a;
          if (
            Math.abs(delta) <= tolerance &&
            (!best || Math.abs(delta) < Math.abs(best.delta))
          )
            best = { delta, v, t };
        }
    }
    if (best) {
      if (!bypass) {
        if (axis === "x") dx = best.delta;
        else dy = best.delta;
      }
      lines.push({
        axis,
        value: best.v,
        from: Math.min(box[other], best.t[other]) - 12 / zoom,
        to:
          Math.max(
            box[other] + box[otherSize],
            best.t[other] + best.t[otherSize],
          ) +
          12 / zoom,
      });
    }
  }
  return { dx, dy, lines };
}
export function duplicateOffset(box, obstacles, gap = 10) {
  let x = box.x + box.w + gap;
  for (let pass = 0; pass <= obstacles.length; pass++) {
    let next = x;
    for (const b of obstacles)
      if (
        box.y < b.y + b.h + gap &&
        box.y + box.h + gap > b.y &&
        x < b.x + b.w + gap &&
        x + box.w + gap > b.x
      )
        next = Math.max(next, b.x + b.w + gap);
    if (next === x) break;
    x = next;
  }
  return x - box.x;
}
