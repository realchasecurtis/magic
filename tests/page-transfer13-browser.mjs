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
  const p = project("Tree transfer"),
    dest = makePage("Second"),
    f = node("frame", 100, 150, 250, 200),
    child = node("rectangle", 130, 180, 70, 50, { parent: f.id });
  p.pages.push(dest);
  p.pages[0].nodes.push(f, child);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "x.magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "magic", version: 3, project: p }),
      ),
    });
  const drag = async () => {
    const a = await page
        .locator(`#layers [data-node="${f.id}"] .name`)
        .boundingBox(),
      b = await page.locator(`[data-page="${dest.id}"]`).boundingBox();
    await page.mouse.move(a.x + 20, a.y + 8);
    await page.mouse.down();
    await page.mouse.move(b.x + 20, b.y + 10, { steps: 8 });
    await page.waitForTimeout(650);
  };
  await drag();
  assert.equal(
    await page.locator("#pages .active [data-page]").getAttribute("data-page"),
    dest.id,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(
    await page.locator("#pages .active [data-page]").getAttribute("data-page"),
    p.pages[0].id,
  );
  await drag();
  await page.mouse.up();
  assert.equal(await page.locator(".node").count(), 2);
  assert.equal(await page.locator(`.node[data-id="${child.id}"]`).count(), 1);
  await page.locator(`[data-page="${p.pages[0].id}"]`).click();
  assert.equal(await page.locator(".node").count(), 0);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator(".node").count(), 2);
  assert.deepEqual(errors, []);
  console.log(
    "Layer-row frame transfer keeps children, page-only drop, Escape rollback and undo passed.",
  );
} finally {
  await browser.close();
}
