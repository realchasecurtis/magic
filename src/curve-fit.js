// Fit cubic curves to sampled contours using chord parameters and recursive error control.
export function fitContour(points, tolerance = 1.2) {
  if (points.length < 5) return points;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const unit = (a, b) => {
    const d = distance(a, b) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  };
  const result = [];
  function fit(ps) {
    const a = ps[0],
      b = ps.at(-1),
      u = unit(a, ps[Math.min(3, ps.length - 1)]),
      v = unit(b, ps[Math.max(0, ps.length - 4)]);
    let total = 0;
    const ts = [0];
    for (let i = 1; i < ps.length; i++) {
      total += distance(ps[i - 1], ps[i]);
      ts.push(total);
    }
    if (!total) return;
    let aa = 0,
      ab = 0,
      bb = 0,
      ar = 0,
      br = 0;
    for (let i = 0; i < ps.length; i++) {
      const t = ts[i] / total,
        q = 1 - t,
        A = 3 * q * q * t,
        B = 3 * q * t * t,
        rx = ps[i].x - (q * q * q + A) * a.x - (t * t * t + B) * b.x,
        ry = ps[i].y - (q * q * q + A) * a.y - (t * t * t + B) * b.y;
      aa += A * A;
      ab += A * B * (u.x * v.x + u.y * v.y);
      bb += B * B;
      ar += A * (u.x * rx + u.y * ry);
      br += B * (v.x * rx + v.y * ry);
    }
    const det = aa * bb - ab * ab;
    let l = det ? (ar * bb - br * ab) / det : total / 3,
      r = det ? (br * aa - ar * ab) / det : total / 3;
    if (l < 0 || r < 0 || l > total * 2 || r > total * 2)
      l = r = distance(a, b) / 3;
    const c = { x: a.x + u.x * l, y: a.y + u.y * l },
      d = { x: b.x + v.x * r, y: b.y + v.y * r };
    let worst = 0,
      index = 1;
    for (let i = 1; i < ps.length - 1; i++) {
      const t = ts[i] / total,
        q = 1 - t,
        e = distance(ps[i], {
          x:
            q ** 3 * a.x +
            3 * q * q * t * c.x +
            3 * q * t * t * d.x +
            t ** 3 * b.x,
          y:
            q ** 3 * a.y +
            3 * q * q * t * c.y +
            3 * q * t * t * d.y +
            t ** 3 * b.y,
        });
      if (e > worst) {
        worst = e;
        index = i;
      }
    }
    if (worst > tolerance && ps.length > 3) {
      fit(ps.slice(0, index + 1));
      fit(ps.slice(index));
    } else {
      if (!result.length) result.push({ ...a });
      result.at(-1).out = c;
      result.push({ ...b, in: d });
    }
  }
  for (let j = 0; j < 4; j++) {
    const start = Math.floor((j * points.length) / 4),
      end = Math.floor(((j + 1) * points.length) / 4);
    fit([...points.slice(start, end), points[end % points.length]]);
  }
  if (result.length > 1) {
    result[0].in = result.at(-1).in;
    result.pop();
  }
  return result;
}
