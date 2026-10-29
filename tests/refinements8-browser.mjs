import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { project, node } from "../src/model.js";
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
try {
  await page.addInitScript(
    () =>
      (window.magicDesktop = {
        armRecording: async () => {},
        previewRecording: async () => {},
      }),
  );
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  const p = project("Resize"),
    n = node("vector", 120, 120, 200, 130, {
      rotation: 90,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0.2 },
        { x: 0.7, y: 1 },
        { x: 0, y: 0.8 },
      ],
      closed: true,
    });
  p.pages[0].nodes.push(n);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "r.magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "magic", version: 3, project: p }),
      ),
    });
  await page.locator(".node").click();
  const before = await page.locator(".selection-box").boundingBox(),
    h = await page.locator(".resize").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 50, h.y + h.height / 2 + 35, {
    steps: 8,
  });
  await page.mouse.up();
  const after = await page.locator(".selection-box").boundingBox();
  assert.ok(Math.abs(after.x - before.x) < 1);
  assert.ok(Math.abs(after.y - before.y) < 1);
  assert.ok(Math.abs(after.width - before.width - 50) < 1);
  assert.ok(Math.abs(after.height - before.height - 35) < 1);
  await page.locator('[data-tool="shape"]').click();
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(780, 520);
  await page.mouse.up();
  assert.equal(
    await page
      .locator('[data-tool="shape"]')
      .evaluate((el) => el.matches(":focus-visible")),
    false,
  );
  for (const id of ["help", "share-button"]) {
    const button = await page.locator("#" + id).boundingBox(),
      icon = await page.locator("#" + id + " svg").boundingBox();
    assert.ok(
      Math.abs(button.x + button.width / 2 - icon.x - icon.width / 2) < 1,
    );
    assert.ok(
      Math.abs(button.y + button.height / 2 - icon.y - icon.height / 2) < 1,
    );
  }
  await page.locator("#record-button").click();
  for (const width of [1400, 700, 480]) {
    await page.setViewportSize({ width, height: 950 });
    assert.ok(
      await page
        .locator("#dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
  }
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.screenshot({ path: "test-results/record-layout8.png" });
  console.log(
    "Rotated edited-vector resize tracks handle, inactive tool has no focus ring, recording dialog fits wide and narrow windows.",
  );
} finally {
  await browser.close();
}
