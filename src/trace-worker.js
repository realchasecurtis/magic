importScripts("../vendor/imagetracer/imagetracer_v1.2.6.js");
onmessage = ({
  data: { pixels, width, height, colors, smoothing, detail, mode, threshold },
}) => {
  try {
    if (mode !== "color") {
      for (let i = 0; i < pixels.length; i += 4) {
        const inside =
          mode === "alpha"
            ? pixels[i + 3] >= threshold
            : pixels[i + 3] > 127 &&
              pixels[i] * 0.2126 +
                pixels[i + 1] * 0.7152 +
                pixels[i + 2] * 0.0722 <
                threshold;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        pixels[i + 3] = inside ? 255 : 0;
      }
    }
    const trace = ImageTracer.imagedataToTracedata(
      { data: pixels, width, height },
      {
        numberofcolors: mode === "color" ? colors : 2,
        colorsampling: 2,
        colorquantcycles: 3,
        ltres: smoothing * smoothing,
        qtres: smoothing * smoothing,
        pathomit: detail,
        rightangleenhance: false,
        blurradius: 1,
        blurdelta: 20,
      },
    );
    const layers = [];
    trace.layers.forEach((paths, colorIndex) => {
      const color = trace.palette[colorIndex];
      if (color.a < 32) return;
      const vertices = [];
      for (const path of paths) {
        if (!path.segments?.length) continue;
        const start = vertices.length,
          segments = path.segments;
        for (let i = 0; i < segments.length; i++) {
          const s = segments[i],
            v = { x: s.x1 / width, y: s.y1 / height };
          if (i === 0 && start) v.breakBefore = true;
          vertices.push(v);
        }
        segments.forEach((s, i) => {
          if (s.type === "Q") {
            const a = vertices[start + i],
              b = vertices[start + ((i + 1) % segments.length)];
            a.out = {
              x: (s.x1 + ((s.x2 - s.x1) * 2) / 3) / width,
              y: (s.y1 + ((s.y2 - s.y1) * 2) / 3) / height,
            };
            b.in = {
              x: (s.x3 + ((s.x2 - s.x3) * 2) / 3) / width,
              y: (s.y3 + ((s.y2 - s.y3) * 2) / 3) / height,
            };
          }
        });
      }
      if (vertices.length >= 2)
        layers.push({
          vertices,
          color:
            "#" +
            [color.r, color.g, color.b]
              .map((c) => c.toString(16).padStart(2, "0"))
              .join(""),
          opacity: color.a / 255,
        });
    });
    postMessage({ layers });
  } catch (e) {
    postMessage({ error: e.message });
  }
};
