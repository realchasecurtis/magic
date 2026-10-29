const cache = new Map();
const placeholder =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
export async function cacheImage(src, image, blob) {
  let entry = cache.get(src);
  if (entry?.preview) return entry;
  entry = entry || {};
  cache.set(src, entry);
  try {
    if (!blob) {
      const comma = src.indexOf(","),
        header = src.slice(0, comma),
        body = src.slice(comma + 1);
      const bytes = header.includes(";base64")
        ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(body));
      blob = new Blob([bytes], { type: header.slice(5).split(";")[0] });
    }
    entry.original = entry.original || URL.createObjectURL(blob);
    if (!image) {
      image = await createImageBitmap(blob);
      entry.close = true;
    }
    const scale = Math.min(
        1,
        1024 /
          Math.max(
            image.naturalWidth || image.width,
            image.naturalHeight || image.height,
          ),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(
      1,
      Math.round((image.naturalWidth || image.width) * scale),
    );
    canvas.height = Math.max(
      1,
      Math.round((image.naturalHeight || image.height) * scale),
    );
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const preview = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    entry.preview = preview ? URL.createObjectURL(preview) : entry.original;
    if (entry.close) image.close();
    return entry;
  } catch {
    entry.failed = true;
    return entry;
  }
}
export function imageURL(n, zoom, refresh) {
  let entry = cache.get(n.src);
  if (!entry) {
    entry = {};
    cache.set(n.src, entry);
    cacheImage(n.src).then(() => requestAnimationFrame(refresh));
  }
  return (
    (zoom * Math.max(n.w, n.h) > 1024 ? entry.original : entry.preview) ||
    entry.original ||
    placeholder
  );
}
