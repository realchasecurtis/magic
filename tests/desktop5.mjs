import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const { _electron } = await import(
  pathToFileURL(process.env.MAGIC_PLAYWRIGHT_PATH).href
);
const apps = [];
const errors = [];
async function launch(name) {
  const profile = path.resolve("desktop-test-profile", name + "-" + Date.now());
  await fs.mkdir(profile, { recursive: true });
  const app = await _electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: [
      ".",
      "--test-hidden",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
    env: { ...process.env, MAGIC_TEST_PROFILE: profile },
  });
  apps.push(app);
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector(".node");
  return { app, page };
}
try {
  const host = await launch("host5"),
    guest = await launch("guest5");
  await host.page.locator("#new-project").click();
  const b = await host.page.locator("#viewport").boundingBox();
  await host.page.locator('[data-tool="shape"]').click();
  await host.page.mouse.click(b.x + 250, b.y + 180);
  await host.page.locator("#share-button").click();
  await host.page.locator("#share-name").fill("Host");
  await host.page.locator("#host-share").click();
  await host.page.waitForFunction(() =>
    document.querySelector("#share-invite").value.startsWith("magic-share:"),
  );
  const code = await host.page.locator("#share-invite").inputValue();
  await host.page.locator("#dialog-close").click();
  await guest.page.locator("#share-button").click();
  await guest.page.locator("#share-invite").fill(code);
  await guest.page.locator("#share-name").fill("Guest");
  await guest.page.locator("#join-share").click();
  await guest.page.waitForFunction(
    () => document.querySelectorAll(".node").length === 1,
  );
  await guest.page.locator(".layer .name").click();
  await guest.page.locator('[data-prop="w"]').fill("160");
  await guest.page.locator('[data-prop="w"]').press("Tab");
  await host.page.waitForFunction(
    () => document.querySelector(".node").style.width === "160px",
  );
  await guest.page.mouse.move(b.x + 300, b.y + 220);
  await host.page.waitForFunction(() =>
    document.querySelector("#collaborators")?.textContent.includes("Guest"),
  );
  await host.page.locator("#share-button").click();
  await host.page.locator("#leave-share").click();
  await guest.page.waitForFunction(
    () =>
      !document.querySelector("#share-button").classList.contains("sharing"),
  );
  console.log(
    "Two desktop instances shared edits, selections and cursor presence.",
  );
  const savePath = path.resolve("test-results/recording5.webm");
  await host.app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, savePath);
  await host.page.locator("#record-button").click();
  await host.page.locator("#record-system").uncheck();
  await host.page.locator("#record-camera").check();
  await host.page.waitForFunction(
    () => document.querySelector("#camera-preview").videoWidth > 0,
  );
  assert.ok((await host.page.locator("#record-mic-device option").count()) > 1);
  await host.page.locator("#record-start").click();
  await host.page.waitForSelector("#record-indicator", { timeout: 15000 });
  assert.equal(await host.page.locator("#record-webcam").count(), 1);
  await host.page.waitForTimeout(1300);
  await host.page.locator("#record-button").click();
  await host.page.waitForFunction(
    () => document.querySelector("#toast")?.textContent === "Recording saved.",
  );
  assert.ok((await fs.stat(savePath)).size > 1000);
  assert.equal(await host.page.locator("#record-webcam").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "Desktop recording saved WebM with fake microphone/webcam and cleaned up capture.",
  );
} finally {
  for (const app of apps.reverse()) await app.close();
}
