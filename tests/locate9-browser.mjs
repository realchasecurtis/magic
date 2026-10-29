import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { project, node } from "../src/model.js";
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  const p = project("Locate"),
    f = node("frame", 6000, -4000, 1000, 800, { hidden: true }),
    n = node("rectangle", 6200, -3800, 220, 160, {
      rotation: 30,
      parent: f.id,
      name: "Far away",
      hidden: true,
    });
  p.pages[0].nodes.push(f, n);
  await page.locator("#file-input").setInputFiles({
    name: "locate.magic",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "magic", version: 3, project: p }),
    ),
  });
  await page.locator(`[data-locate="${n.id}"]`).click();
  const v = await page.locator("#viewport").boundingBox(),
    b = await page.locator(".selection-box").boundingBox();
  assert.ok(b.x > v.x && b.y > v.y);
  assert.ok(b.x + b.width < v.x + v.width && b.y + b.height < v.y + v.height);
  assert.ok(b.width > v.width * 0.5 || b.height > v.height * 0.5);
  assert.equal(
    await page.locator(".node.selected").getAttribute("data-id"),
    n.id,
  );
  assert.equal(
    await page
      .locator(`[data-locate="${n.id}"]`)
      .evaluate((el) => el.nextElementSibling.hasAttribute("data-visible")),
    true,
  );
  await page.locator(`[data-locate="${f.id}"]`).click();
  assert.equal(
    await page.locator(".node.selected").getAttribute("data-id"),
    f.id,
  );
  console.log(
    "Locate fits distant rotated nested layers and frames, with button left of visibility.",
  );
} finally {
  await browser.close();
}
