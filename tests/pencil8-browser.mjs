import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage();
page.on("pageerror", (e) => console.log("ERROR", e.message));
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  await page.locator("#new-project").click();
  await page.locator("#draw").selectOption("pencil", { force: true });
  await page.locator('[data-tool="pen"]').click();
  const b = await page.locator("#viewport").boundingBox();
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(b.x + 100 + i * 80, b.y + 150);
    await page.mouse.down();
    await page.mouse.move(b.x + 150 + i * 80, b.y + 210, { steps: 8 });
    await page.mouse.up();
  }
  assert.equal(await page.locator(".node").count(), 2);
  await page.keyboard.press("Enter");
  await page.mouse.click(b.x + 300, b.y + 300);
  assert.equal(await page.locator(".node").count(), 2);
  await page.locator("#draw").selectOption("pencil", { force: true });
  await page.mouse.move(b.x + 300, b.y + 150);
  await page.mouse.down();
  await page.mouse.move(b.x + 350, b.y + 200);
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await page.mouse.click(b.x + 400, b.y + 300);
  assert.equal(await page.locator(".node").count(), 3);
  console.log(
    "Pencil continues across releases; Enter and Escape exit while retaining strokes.",
  );
} finally {
  await browser.close();
}
