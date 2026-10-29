import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { project, page as makePage, node } from "../src/model.js";
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto((process.env.MAGIC_TEST_URL || "http://127.0.0.1:4173"));
  await page.waitForSelector(".node");
  const p = project("Drag tests"),
    dest = makePage("Destination"),
    n = node("rectangle", 100, 150, 100, 80),
    other = node("rectangle", 210, 150, 100, 80),
    ref = node("rectangle", 100, 350, 100, 80);
  p.pages.push(dest);
  p.pages[0].nodes.push(n, other, ref);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "x.magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "magic", version: 3, project: p }),
      ),
    });
  await page.locator(`.node[data-id="${n.id}"]`).click();
  await page.keyboard.press("Control+d");
  assert.equal(await page.locator('[data-prop="x"]').inputValue(), "320");
  assert.equal(await page.locator('[data-prop="y"]').inputValue(), "150");
  await page.keyboard.press("Control+z");
  let b = await page.locator(`.node[data-id="${n.id}"]`).boundingBox();
  await page.mouse.move(b.x + 30, b.y + 30);
  await page.mouse.down();
  await page.mouse.move(b.x + 33, b.y + 50, { steps: 4 });
  assert.ok((await page.locator(".alignment-guide").count()) > 0);
  await page.mouse.up();
  await page.locator(`.node[data-id="${n.id}"]`).click();
  b = await page.locator(`.node[data-id="${n.id}"]`).boundingBox();
  const target = await page.locator(`[data-page="${dest.id}"]`).boundingBox();
  await page.mouse.move(b.x + 30, b.y + 30);
  await page.mouse.down();
  await page.mouse.move(target.x + 30, target.y + target.height / 2, {
    steps: 8,
  });
  await page.waitForTimeout(650);
  assert.equal(
    await page.locator("#pages .active [data-page]").getAttribute("data-page"),
    dest.id,
  );
  const v = await page.locator("#viewport").boundingBox();
  await page.mouse.move(v.x + 300, v.y + 250, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator(`.node[data-id="${n.id}"]`).count(), 1);
  await page.locator(`[data-page="${p.pages[0].id}"]`).click();
  assert.equal(await page.locator(`.node[data-id="${n.id}"]`).count(), 0);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(`.node[data-id="${n.id}"]`).count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    "Clear duplicates, live guides, hover page transfer and undo passed.",
  );
} finally {
  await browser.close();
}
