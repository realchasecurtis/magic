import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { project, node } from "../src/model.js";
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  const p = project("New controls"),
    f = node("frame", 40, 40, 200, 200),
    t = node("text", 300, 100, 250, 80, { text: "Typography", fontSize: 24 });
  p.pages[0].nodes.push(f, t);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "test.magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "magic", version: 3, project: p }),
      ),
    });
  await page.locator(`.node[data-id="${f.id}"]`).click();
  await page.locator("#frame-template").selectOption("0");
  assert.equal(await page.locator('[data-prop="w"]').inputValue(), "1200");
  assert.equal(await page.locator('[data-prop="h"]').inputValue(), "1800");
  await page.locator('[data-prop="w"]').fill("200");
  await page.locator('[data-prop="w"]').press("Tab");
  await page.locator('[data-prop="h"]').fill("200");
  await page.locator('[data-prop="h"]').press("Tab");
  await page.locator(`.node[data-id="${t.id}"]`).click();
  await page.locator("#font-picker").click();
  await page.locator("#font-search").fill("Lora");
  assert.equal(await page.locator("#font-list button").count(), 1);
  await page.locator("#font-list button").click();
  assert.match(await page.locator("#font-picker").textContent(), /Lora/);
  await page.locator('[data-text-align="center"]').click();
  assert.equal(
    await page
      .locator('[data-text-align="center"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#font-import").setInputFiles("assets/fonts/inter.ttf");
  await page.waitForFunction(() =>
    document.querySelector("#font-picker").textContent.includes("inter"),
  );
  await page.waitForTimeout(500);
  await page.reload();
  await page.locator(`.node[data-id="${t.id}"]`).click();
  assert.match(await page.locator("#font-picker").textContent(), /inter/);
  await page.screenshot({ path: "test-results/inspector7.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Templates, font search, icon alignment, imported font persistence passed.",
  );
} finally {
  await browser.close();
}
