import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { project, node } from "../src/model.js";
const { chromium } = await import(
    pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
  ),
  browser = await chromium.launch({ headless: true, channel: "msedge" }),
  page = await browser.newPage({ viewport: { width: 1500, height: 950 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4173");
  await page.waitForSelector(".node");
  const p = project("Interaction test"),
    pg = p.pages[0],
    frame = node("frame", 60, 80, 300, 260, { name: "Frame" }),
    child = node("rectangle", 100, 120, 100, 90, {
      parent: frame.id,
      name: "Button",
    }),
    hidden = node("rectangle", 230, 120, 60, 60, {
      parent: frame.id,
      name: "Hidden",
      hidden: true,
    }),
    group = node("group", 450, 90, 200, 160, { name: "Group" }),
    member = node("rectangle", 470, 110, 100, 100, {
      parent: group.id,
      name: "Member",
    }),
    text = node("text", 80, 440, 260, 80, {
      name: "Text",
      text: "Edit me",
      fontSize: 24,
    }),
    loose = node("rectangle", 500, 400, 80, 60, { name: "Loose" });
  pg.nodes.push(frame, child, hidden, group, member, text, loose);
  await page
    .locator("#file-input")
    .setInputFiles({
      name: "interactions.magic",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ format: "magic", version: 3, project: p }),
      ),
    });
  await page.waitForFunction(
    () => document.querySelector("#project-name").value === "Interaction test",
  );
  await page.locator(`.node[data-id="${child.id}"]`).click();
  assert.equal(
    await page.locator(".node.selected").getAttribute("data-id"),
    frame.id,
  );
  await page.locator(`.node[data-id="${child.id}"]`).dblclick();
  await page.locator(`.node[data-id="${child.id}"]`).click();
  assert.equal(
    await page.locator(".node.selected").getAttribute("data-id"),
    child.id,
  );
  await page.keyboard.press("Escape");
  const visibility = page.locator(`[data-visible="${frame.id}"]`);
  await visibility.click();
  assert.equal(await page.locator(`.node[data-id="${child.id}"]`).count(), 0);
  await visibility.click();
  assert.equal(await page.locator(`.node[data-id="${hidden.id}"]`).count(), 1);
  await page
    .locator(`.node[data-id="${member.id}"]`)
    .click({ button: "right" });
  assert.equal(
    await page.locator('#context-menu [data-command="ungroup"]').count(),
    1,
  );
  assert.equal(
    await page.locator('#context-menu [data-command="group"]').count(),
    1,
  );
  await page.keyboard.press("Escape");
  await page.locator(`.node[data-id="${text.id}"]`).dblclick();
  await page.locator("#live-text-editor").fill("Typing live on the canvas");
  await page.locator("#live-text-editor").press("Space");
  assert.ok(
    await page
      .locator("#live-text-editor")
      .evaluate((el) => el === document.activeElement),
  );
  await page.locator("#live-text-editor").press("Control+Enter");
  assert.match(
    await page.locator(`.node[data-id="${text.id}"]`).textContent(),
    /Typing live/,
  );
  await page.locator(`.node[data-id="${frame.id}"] .frame-label`).dblclick();
  const title = page.locator(".frame-label input");
  await title.fill("New");
  await title.press("Space");
  await title.press("G");
  assert.equal(await title.inputValue(), "New G");
  await title.press("Enter");
  await page.locator("#pages [data-page]").dblclick();
  const rename = page.locator("#pages .inline-name");
  await rename.fill("Inline page");
  await rename.press("Enter");
  assert.match(await page.locator("#pages").textContent(), /Inline page/);
  assert.equal(await page.locator("#dialog").evaluate((e) => e.open), false);
  await page.locator("#project-name").fill("Confirmed");
  await page.locator("#project-name").press("Space");
  assert.equal(
    await page
      .locator("#project-name")
      .evaluate((el) => el === document.activeElement),
    false,
  );
  assert.match(await page.locator("#tabs").textContent(), /Confirmed/);
  await page.locator(`.node[data-id="${loose.id}"]`).click();
  await page.locator('[data-paint="fills"][data-key="color"]').click();
  await page.locator("#picker-opacity").fill("35");
  await page.locator("#picker-opacity").dispatchEvent("input");
  assert.equal(
    await page.locator('[data-paint="fills"][data-key="opacity"]').inputValue(),
    "35",
  );
  await page.locator("#close-picker").click();
  const l = await page.locator(`.node[data-id="${loose.id}"]`).boundingBox(),
    f = await page.locator(`.node[data-id="${frame.id}"]`).boundingBox();
  await page.mouse.move(l.x + 30, l.y + 30);
  await page.mouse.down();
  await page.mouse.move(f.x + 150, f.y + 170, { steps: 10 });
  assert.equal(await page.locator(".drop-target").count(), 1);
  assert.equal(
    await page.locator(".node").last().getAttribute("data-id"),
    loose.id,
  );
  await page.mouse.up();
  assert.equal(await page.locator(".drop-target").count(), 0);
  await page.waitForTimeout(300);
  assert.deepEqual(errors, []);
  console.log(
    "Interaction checks passed: container entry, branch visibility, ungroup menu, live text, title spaces, inline pages, project confirmation, paint opacity and drop preview.",
  );
} finally {
  await browser.close();
}
