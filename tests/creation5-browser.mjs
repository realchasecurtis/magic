import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(
  pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1500, height: 950 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  await page.locator("#new-project").click();
  const b = await page.locator("#viewport").boundingBox();
  await page.locator('[data-tool="text"]').click();
  await page.mouse.click(b.x + 200, b.y + 180);
  await page
    .locator('[data-prop="text"]')
    .fill("This text must wrap when the box becomes narrow.");
  await page.locator('[data-prop="text"]').press("Tab");
  const size = await page.locator('[data-prop="fontSize"]').inputValue();
  await page.locator('[data-prop="w"]').fill("120");
  await page.locator('[data-prop="w"]').press("Tab");
  assert.equal(await page.locator('[data-prop="fontSize"]').inputValue(), size);
  assert.ok(
    (await page.locator(".node.selected > svg > text > tspan").count()) > 2,
  );
  await page.locator('[data-tool="pen"]').click();
  await page.mouse.move(b.x + 400, b.y + 200);
  await page.mouse.down();
  await page.mouse.move(b.x + 440, b.y + 160, { steps: 6 });
  await page.mouse.up();
  await page.mouse.move(b.x + 550, b.y + 250);
  await page.mouse.down();
  await page.mouse.move(b.x + 590, b.y + 280, { steps: 6 });
  await page.mouse.up();
  await page.mouse.click(b.x + 500, b.y + 390);
  await page.mouse.move(b.x + 402, b.y + 202);
  await page.mouse.click(b.x + 402, b.y + 202);
  assert.ok(
    await page
      .locator(".node.selected > svg > path")
      .first()
      .getAttribute("d")
      .then((d) => d.includes("C") && d.endsWith("Z")),
  );
  const result = await page.evaluate(async () => {
    const worker = new Worker("/src/trace-worker.js");
    const width = 128,
      height = 128,
      pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const k = (y * width + x) * 4;
        if (Math.hypot(x - 40, y - 64) < 28) {
          pixels[k] = 255;
          pixels[k + 3] = 255;
        }
        if (Math.hypot(x - 95, y - 64) < 20) {
          pixels[k + 2] = 255;
          pixels[k + 3] = 255;
        }
      }
    return await new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        worker.terminate();
        resolve(e.data);
      };
      worker.onerror = reject;
      worker.postMessage({
        pixels,
        width,
        height,
        colors: 4,
        smoothing: 3,
        detail: 12,
        mode: "color",
        threshold: 128,
      });
    });
  });
  assert.ok(result.layers?.length >= 2, JSON.stringify(result));
  assert.ok(result.layers.reduce((n, l) => n + l.vertices.length, 0) < 60);
  console.log(
    "Color trace: " +
      result.layers.length +
      " layers, " +
      result.layers.reduce((n, l) => n + l.vertices.length, 0) +
      " anchors.",
  );
  const formats = await page.evaluate(async () => {
    const convert = (files, format) =>
      new Promise((resolve, reject) => {
        const w = new Worker("/src/model-worker.js");
        w.onmessage = (e) => {
          w.terminate();
          e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
        };
        w.onerror = reject;
        w.postMessage({ files, format });
      });
    const input = [
      {
        name: "triangle.obj",
        bytes: new TextEncoder().encode("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3"),
      },
    ];
    const fbx = await convert(input, "FBX"),
      obj = await convert(
        [{ name: "triangle.fbx", bytes: new TextEncoder().encode(fbx.text) }],
        "OBJ",
      ),
      glb = await convert(input, "GLB"),
      stl = await convert([{ name: "triangle.glb", bytes: glb.bytes }], "STL");
    return {
      fbx: fbx.text,
      obj: obj.text,
      glb: glb.bytes.length,
      stl: stl.text,
    };
  });
  assert.match(formats.fbx, /FBXVersion: 7400/);
  assert.match(formats.obj, /f 1 2 3/);
  assert.ok(formats.glb > 100);
  assert.match(formats.stl, /facet normal/);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "test-results/creation5.png" });
  console.log(
    "Creation checks passed: responsive text, pen handles/closing snap, color tracing, OBJ → FBX → OBJ and OBJ → GLB → STL.",
  );
} finally {
  await browser.close();
}
