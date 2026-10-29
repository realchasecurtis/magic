// Resize an upright selection while preserving the opposite visual corner.
export function resizeUpright(original, dx, dy, proportional = false) {
  const a = ((original.rotation || 0) * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a)),
    bw = c * original.w + s * original.h,
    bh = s * original.w + c * original.h;
  const tw = Math.max(5, bw + dx),
    th = Math.max(5, bh + dy),
    det = c * c - s * s;
  let w, h;
  if (proportional || Math.abs(det) < 0.08) {
    const scale = Math.max(
      5 / Math.min(original.w, original.h),
      (tw * bw + th * bh) / (bw * bw + bh * bh),
    );
    w = original.w * scale;
    h = original.h * scale;
  } else {
    w = (c * tw - s * th) / det;
    h = (c * th - s * tw) / det;
    if (w < 5) {
      w = 5;
      h = Math.max(5, s * (tw - c * w) + c * (th - s * w));
    }
    if (h < 5) {
      h = 5;
      w = Math.max(5, c * (tw - s * h) + s * (th - c * h));
    }
  }
  const nw = c * w + s * h,
    nh = s * w + c * h;
  return {
    w,
    h,
    x: original.x + (original.w - bw) / 2 + (nw - w) / 2,
    y: original.y + (original.h - bh) / 2 + (nh - h) / 2,
  };
}
