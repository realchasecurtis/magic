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
  await page.addInitScript(
    () =>
      (window.magicDesktop = {
        armRecording: async () => {},
        previewRecording: async () => {},
        onShare: () => {},
        hostShare: async () => {},
      }),
  );
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  const p = project("Text and comments"),
    t = node("text", 150, 150, 250, 80, { text: "Before", fontSize: 24 }),
    c = node("comment", 500, 300, 36, 36, {
      comments: [
        { author: "A", text: "Older comment", date: "2026-10-27T12:00:00Z" },
        { author: "B", text: "Newest reply", date: "2026-10-28T12:00:00Z" },
      ],
    });
  p.pages[0].nodes.push(t, c);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "x.magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "magic", version: 3, project: p }),
      ),
    });
  await page.locator(`.node[data-id="${t.id}"]`).click();
  await page.locator('[data-prop="text"]').fill("Live sidebar");
  assert.match(
    await page.locator(`.node[data-id="${t.id}"]`).textContent(),
    /Live sidebar/,
  );
  await page.locator(`.node[data-id="${t.id}"]`).dblclick();
  await page.locator("#live-text-editor").fill("Live canvas");
  assert.equal(
    await page.locator('[data-prop="text"]').inputValue(),
    "Live canvas",
  );
  const v = await page.locator("#viewport").boundingBox();
  await page.mouse.click(v.x + 35, v.y + 35);
  assert.equal(await page.locator("#live-text-editor").count(), 0);
  assert.equal(await page.locator(`#layers [data-node="${c.id}"]`).count(), 0);
  await page.locator("#comments-toggle").click();
  assert.match(
    await page.locator(".comment-list-entry").first().textContent(),
    /Newest reply/,
  );
  await page.locator("#comments-close").click();
  const before = await page.locator(".comment-pin").boundingBox();
  await page.mouse.move(v.x + 300, v.y + 300);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(100);
  const after = await page.locator(".comment-pin").boundingBox();
  assert.ok(Math.abs(before.width - after.width) < 1);
  await page.locator("#record-button").click();
  await page.locator("#record-camera-size").fill("300");
  await page.locator("#record-camera-size").dispatchEvent("input");
  assert.equal(
    await page.locator("#camera-preview").evaluate((e) => e.style.width),
    "300px",
  );
  await page.locator("#dialog-close").click();
  await page.locator("#share-button").click();
  const host = await page.locator("#host-share").boundingBox(),
    invite = await page.locator("#share-invite").boundingBox();
  assert.ok(invite.y > host.y + host.height);
  assert.deepEqual(errors, []);
  console.log(
    "Live text sync, click-away commit, comments list/zoom, sharing layout and webcam size passed.",
  );
} finally {
  await browser.close();
}
