import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { project } from "../src/model.js";
const { chromium } = await import(
  pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
);
const browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto((process.env.MAGIC_TEST_URL || "http://127.0.0.1:4173"));
  await page.waitForSelector(".node");
  for (const name of ["Images", "Other"])
    await page.locator("#file-input").setInputFiles({
      name: name + ".magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "magic",
          version: 3,
          project: project(name),
        }),
      ),
    });
  const tabs = page.locator("#tabs [data-project]");
  await tabs.nth(1).click();
  assert.match(await page.locator("#tabs .active").innerText(), /Images/);
  const first = await tabs.nth(0).boundingBox(),
    last = await tabs.nth(2).boundingBox();
  await page.mouse.move(last.x + 20, last.y + 15);
  await page.mouse.down();
  await page.mouse.move(first.x + 5, first.y + 15, { steps: 8 });
  assert.match(await tabs.first().innerText(), /Other/);
  await page.mouse.up();
  await page
    .locator("#tabs [data-project]")
    .filter({ hasText: "Images" })
    .click();
  const images = await page.evaluate(() =>
    Array.from({ length: 20 }, (_, i) => {
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = 1536;
      const ctx = c.getContext("2d"),
        d = ctx.createImageData(c.width, c.height);
      let seed = i + 1;
      for (let j = 0; j < d.data.length; j += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d.data[j] = seed & 255;
        d.data[j + 1] = (seed >>> 8) & 255;
        d.data[j + 2] = (seed >>> 16) & 255;
        d.data[j + 3] = 255;
      }
      ctx.putImageData(d, 0, 0);
      return c.toDataURL("image/jpeg", 0.88).split(",")[1];
    }),
  );
  await page.locator("#file-input").setInputFiles(
    images.map((data, i) => ({
      name: `image${i}.jpg`,
      mimeType: "image/jpeg",
      buffer: Buffer.from(data, "base64"),
    })),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".node img").length === 20,
  );
  await page.waitForFunction(
    () =>
      document.querySelector("#save-state").textContent ===
      "Saved on this device",
  );
  const result = await page.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("magic-workspace");
      q.onsuccess = () => r(q.result);
    });
    const state = await new Promise((r) => {
      const q = db
        .transaction("workspace")
        .objectStore("workspace")
        .get("state");
      q.onsuccess = () => r(q.result);
    });
    const p = state.projects.find((p) => p.name === "Images"),
      ns = p.pages[0].nodes;
    for (let i = 0; i < ns.length; i++)
      for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i],
          b = ns[j];
        if (!(
          a.x + a.w + 9.9 <= b.x ||
          b.x + b.w + 9.9 <= a.x ||
          a.y + a.h + 9.9 <= b.y ||
          b.y + b.h + 9.9 <= a.y
        ))
          throw Error("Imported images overlap");
      }
    window.savedImage = document.querySelector(".node img");
    return {
      snapshotBytes: JSON.stringify(state).length,
      blobPreviews: [...document.querySelectorAll(".node img")].every((n) =>
        n.src.startsWith("blob:"),
      ),
    };
  });
  assert.ok(result.snapshotBytes < 100000);
  assert.ok(result.blobPreviews);
  const start = Date.now();
  await page.locator(".node").first().click();
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowRight");
  result.twentyEditsMs = Date.now() - start;
  assert.ok(
    await page.evaluate(
      () => window.savedImage === document.querySelector(".node img"),
    ),
  );
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(
    () => document.querySelectorAll('.node img[src^="blob:"]').length === 20,
  );
  const reopened = Date.now();
  await page.locator(".node").first().click();
  for (let i = 0; i < 20; i++) await page.keyboard.press("ArrowLeft");
  result.twentyEditsAfterReopenMs = Date.now() - reopened;
  assert.deepEqual(errors, []);
  console.log(
    "20 high-resolution images: spacing, compact autosave, decoded image reuse, editing, tab preview/clicks and reload passed.",
    result,
  );
} catch (e) {
  console.error(e);
  throw e;
} finally {
  await browser.close();
}
