import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { chromium } = await import(
  pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
);
const browser = await chromium.launch({ channel: "msedge", headless: true }),
  page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  await page.locator("#new-project").click();
  const b = await page.locator("#viewport").boundingBox();
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-tool="shape"]').click();
    await page.mouse.click(b.x + 180 + i * 180, b.y + 200);
  }
  const rows = page.locator("#layers .layer"),
    first = await rows.first().boundingBox(),
    panel = await page.locator("#layers").boundingBox();
  await page.mouse.move(panel.x + 90, panel.y + 150);
  await page.mouse.down();
  await page.mouse.move(panel.x + 90, first.y + 2, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator("#layers .layer.selected").count(), 2);
  const ids = await rows.evaluateAll((rs) => rs.map((r) => r.dataset.node));
  const a = await rows.first().boundingBox(),
    z = await rows.last().boundingBox();
  await page.mouse.move(z.x + 90, z.y + 12);
  await page.mouse.down();
  await page.mouse.move(a.x + 90, a.y + 12, { steps: 8 });
  await page.mouse.up();
  assert.equal(await rows.first().getAttribute("data-node"), ids[1]);
  console.log("Layer marquee and row reordering passed.");
} finally {
  await browser.close();
}
