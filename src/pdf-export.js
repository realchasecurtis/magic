// A single-page PDF with a JPEG image. Offsets and stream lengths are byte-based.
// Canvas exports are flattened, with a white background for PDF and JPEG.
export function rasterPDF(width, height, jpeg) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  )
    throw Error("Invalid PDF dimensions");
  if (!(jpeg instanceof Uint8Array) || jpeg[0] !== 255 || jpeg[1] !== 216)
    throw Error("PDF requires JPEG bytes");
  const enc = new TextEncoder(),
    chunks = [],
    offsets = [0];
  let length = 0;
  const push = (value) => {
    const bytes = typeof value === "string" ? enc.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, content) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${content}\nendobj\n`);
  };
  const w = width * 0.75,
    h = height * 0.75;
  push("%PDF-1.4\n%Magic image export\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets[4] = length;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  object(
    5,
    `<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`,
  );
  const start = length;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++)
    push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const bytes of chunks) {
    result.set(bytes, offset);
    offset += bytes.length;
  }
  return result;
}
