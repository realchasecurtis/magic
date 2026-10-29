import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { project, node } from "../src/model.js";
import { projectPatch, applyPatch } from "../src/project-sync.js";
import { fitText, textLines } from "../src/text-layout.js";
const { Collaboration } = createRequire(import.meta.url)(
  "../desktop/collaboration.cjs",
);
test("text reflows without changing typography and expands to fit", () => {
  const n = node("text", 0, 0, 220, 30, {
    text: "A sentence that needs multiple lines",
    fontSize: 20,
  });
  fitText(n);
  const first = textLines(n).length;
  n.w = 100;
  fitText(n);
  assert.ok(textLines(n).length > first);
  assert.equal(n.fontSize, 20);
  assert.ok(n.h >= textLines(n).length * 24);
  n.h = 24;
  fitText(n, "h");
  assert.equal(textLines(n).length, 1);
  assert.equal(n.fontSize, 20);
});
test("concurrent independent edits merge by field", () => {
  const p = project();
  p.pages[0].nodes.push(node("rectangle"));
  const a = structuredClone(p),
    b = structuredClone(p);
  a.pages[0].nodes[0].x = 40;
  b.pages[0].nodes[0].fill = "#ff0000";
  const merged = applyPatch(
    applyPatch(p, projectPatch(p, a)),
    projectPatch(p, b),
  );
  assert.equal(merged.pages[0].nodes[0].x, 40);
  assert.equal(merged.pages[0].nodes[0].fill, "#ff0000");
});
test("encrypted host/join shares edits and presence", async () => {
  const events = [],
    host = new Collaboration(
      (m) => events.push(m),
      applyPatch,
      (p) => p,
    ),
    guest = new Collaboration(
      (m) => events.push(m),
      applyPatch,
      (p) => p,
    );
  try {
    const p = project();
    p.pages[0].nodes.push(node("rectangle"));
    const invite = await host.host(p, "Host", "127.0.0.1");
    await guest.join(invite.local, "Guest");
    const updated = structuredClone(p);
    updated.pages[0].nodes[0].x = 52;
    guest.publish({ type: "patch", ops: projectPatch(p, updated) });
    guest.publish({
      type: "presence",
      page: p.pages[0].id,
      cursor: { x: 12, y: 34 },
      selection: [p.pages[0].nodes[0].id],
    });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(host.project.pages[0].nodes[0].x, 52);
    assert.ok(events.some((e) => e.type === "presence" && e.cursor?.x === 12));
  } finally {
    guest.leave();
    host.leave();
  }
});
