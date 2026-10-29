import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
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
  await page.locator('[data-tool="shape"]').click();
  await page.mouse.click(b.x + 200, b.y + 200);
  assert.equal(await page.locator(".size-badge").textContent(), "100 × 100");
  await page.locator(".node").dblclick();
  await page.waitForSelector(".vector-overlay");
  assert.equal(await page.locator(".selection-box").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".selection-box").count(), 1);
  const r = await page.locator(".rotation-zone.top-right").boundingBox();
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + 45, r.y + 90, { steps: 10 });
  await page.mouse.up();
  assert.equal(
    await page
      .locator(".selection-box")
      .evaluate((e) => getComputedStyle(e).transform),
    "none",
  );
  assert.ok(
    Math.abs(
      Number(await page.locator('[data-prop="rotation"]').inputValue()),
    ) > 10,
  );
  await page.mouse.click(b.x + 500, b.y + 400);
  const n = await page.locator(".node").boundingBox();
  await page.mouse.move(n.x - 30, n.y - 30);
  await page.mouse.down();
  await page.mouse.move(n.x + 10, n.y + 10);
  await page.mouse.up();
  assert.equal(await page.locator(".node.selected").count(), 1);
  assert.equal(
    await page
      .locator("#viewport")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
    "none",
  );
  await page.locator("#pages [data-page]").dblclick();
  await page.locator("#pages .inline-name").fill("Renamed page");
  await page.locator("#pages .inline-name").press("Enter");
  assert.match(await page.locator("#pages").textContent(), /Renamed page/);
  const d = await page.locator("#sidebar-divider").boundingBox();
  await page.mouse.move(d.x + 3, d.y + 150);
  await page.mouse.down();
  await page.mouse.move(320, d.y + 150);
  await page.mouse.up();
  assert.equal(
    await page
      .locator(".workspace")
      .evaluate((e) => e.getBoundingClientRect().left),
    320,
  );
  await page.locator("#help").click();
  assert.equal(await page.locator("#dialog").evaluate((e) => e.open), true);
  await page.locator("#dialog-close").click();
  await page.locator("#updates").click();
  assert.match(
    await page.locator("#update-status").textContent(),
    /not been configured/,
  );
  await page.locator("#dialog-close").click();
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "triangle.obj",
      mimeType: "text/plain",
      buffer: Buffer.from("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3"),
    });
  await page.waitForFunction(() =>
    document.querySelector("#export-format")?.textContent.includes("STL"),
  );
  await page.locator("#export-format").selectOption("STL");
  const download = page.waitForEvent("download");
  await page.locator("#export-design").click();
  assert.match((await download).suggestedFilename(), /\.stl$/);
  const save = page.waitForEvent("download");
  await page.locator("#save-project").click();
  assert.match((await save).suggestedFilename(), /\.magic$/);
  assert.deepEqual(errors, []);
  console.log("Workspace browser checks passed.");
} finally {
  await browser.close();
}

