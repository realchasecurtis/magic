import { compactState, hydrateState, markStored } from "./asset-storage.js";
import { cacheImage, imageURL } from "./image-cache.js";
import { snapBounds, duplicateOffset } from "./alignment.js";
let alignmentGuides = [];
let commentsPanelOpen = false;
const mediaExportChoices = new Map();
import { resizeUpright } from "./resize.js";
import { enhanceInspector, loadFonts } from "./inspector-extras.js";
import { installSharing } from "./sharing.js";
import { installRecording } from "./recording.js";
import { fitText } from "./text-layout.js";
import { readMesh, writeMesh } from "./mesh.js";
import {
  uid,
  clone,
  node,
  page,
  project,
  starter,
  descendants,
  bounds,
  contains,
  validateProject,
  copyNodes,
} from "./model.js";
import { escape as esc, shapeSVG, exportSVG, paints } from "./render.js";
import {
  pathData,
  editableTypes,
  vectorize,
  localPoint,
  curvePoint,
  splitEdge,
  rangeSelection,
  normalizeVector,
  nearestEdge,
  bendEdge,
  nextVertexIndex,
  removeVertex,
} from "./vector.js";
import {
  penIcon,
  pencilIcon,
  commentIcon,
  chevronIcon,
  eyeIcon,
  lockIcon,
} from "./icons.js";
import { rasterPDF } from "./pdf-export.js";
import { installColorPicker } from "./color-picker.js";
import {
  tracePixels,
  removeEdgeBackground,
  removeAutoBackground,
} from "./image-actions.js";
import { createComments } from "./comments.js";
let enteredContainer = null,
  lastCanvasDouble = 0,
  textEditor = null,
  dropTarget = null,
  lastPageClick = null;
let edgeHover = null,
  paintSession = null;
let lastCanvasClick = null,
  lastTreeClick = null;
let editingId = null,
  vertexIndex = null,
  selectionAnchor = null,
  penHover = null;
let preferences = { usage: {}, shape: "rectangle", draw: "pen" };
try {
  Object.assign(
    preferences,
    JSON.parse(localStorage.getItem("magic-preferences") || "{}"),
  );
} catch {}

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let projects = [],
  activeId,
  selected = new Set(),
  tool = "move",
  collapsed = new Set(),
  clipboard = [],
  history = [],
  future = [],
  gesture = null,
  space = false,
  penPoints = [],
  saving;
const db = await new Promise((resolve, reject) => {
  const r = indexedDB.open("magic-workspace", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("workspace");
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
}).catch(() => null);
if (db) {
  const saved = await new Promise((resolve) => {
    const r = db.transaction("workspace").objectStore("workspace").get("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
  if (saved) {
    try {
      await hydrateState(saved, db);
      saved.projects.forEach(validateProject);
      projects = saved.projects;
      activeId = saved.activeId;
    } catch {
      toast("Saved workspace could not be loaded. Import a backup to recover.");
    }
  }
}
if (!projects.length) {
  projects = [starter()];
  activeId = projects[0].id;
}
if (!projects.some((p) => p.id === activeId)) activeId = projects[0].id;
const current = () => projects.find((p) => p.id === activeId),
  pg = () =>
    current().pages.find((p) => p.id === current().activePage) ||
    current().pages[0],
  nodes = () => pg().nodes,
  view = () => pg().view || (pg().view = { x: 60, y: 60, zoom: 1 }),
  picked = () => nodes().filter((n) => selected.has(n.id));
const commentUI = createComments({
  viewport: $("#viewport"),
  getPage: pg,
  getView: view,
  getNodes: nodes,
  change,
  makeNode: node,
  escape: esc,
  select: (id) => {
    selected = new Set([id]);
    tool = "move";
  },
  authorName: () => preferences.author || "You",
  onAuthor: (author) => {
    preferences.author = author;
    savePreferences();
  },
});
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function save() {
  clearTimeout(saving);
  $("#save-state").textContent = "Saving…";
  saving = setTimeout(() => {
    if (!db) {
      $("#save-state").textContent = "Storage unavailable — export a backup";
      return;
    }
    const tx = db.transaction("workspace", "readwrite");
    const keys = [],
      store = tx.objectStore("workspace");
    store.put(compactState({ projects, activeId }, store, keys), "state");
    tx.oncomplete = () => {
      markStored(keys);
      $("#save-state").textContent = "Saved on this device";
    };
    tx.onerror = () => {
      $("#save-state").textContent = "Save failed — export a backup";
      toast("Storage is full or unavailable. Save a project file.");
    };
  }, 250);
}
function checkpoint() {
  history.push(clone({ projects, activeId }));
  if (history.length > 60) history.shift();
  future = [];
}
function change(fn) {
  checkpoint();
  fn();
  render();
  save();
}
function restore(from, to) {
  if (!from.length) return;
  editingId = null;
  vertexIndex = null;
  edgeHover = null;
  paintSession = null;
  tool = "move";
  commentUI.close();
  to.push(clone({ projects, activeId }));
  const state = from.pop();
  projects = state.projects;
  activeId = state.activeId;
  selected.clear();
  render();
  save();
}
function hidden(n) {
  const map = new Map(nodes().map((n) => [n.id, n]));
  let p = n;
  while (p) {
    if (p.hidden) return true;
    p = map.get(p.parent);
  }
  return false;
}
function locked(n) {
  const map = new Map(nodes().map((n) => [n.id, n]));
  let p = n;
  while (p) {
    if (p.locked) return true;
    p = map.get(p.parent);
  }
  return false;
}
function render() {
  loadFonts(current());
  if (enteredContainer && !nodes().some((n) => n.id === enteredContainer))
    enteredContainer = null;
  if (!nodes().some((n) => n.id === editingId && n.type === "vector"))
    editingId = null;
  selected = new Set(
    [...selected]
      .map((id) => {
        const n = nodes().find((n) => n.id === id);
        return n ? canvasTarget(n).id : null;
      })
      .filter(Boolean),
  );
  renderExport();
  updateToolIcons();
  renderTabs();
  renderPages();
  renderLayers();
  renderCanvas();
  renderInspector();
  $("#project-name").value = current().name;
  $("#breadcrumb").textContent =
    `${current().name} / ${pg().name}` +
    (enteredContainer
      ? " / Editing " +
        nodes().find((n) => n.id === enteredContainer)?.name +
        " · Esc to exit"
      : "");
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
  $$("[data-tool]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === tool),
  );
}
function renderTabs() {
  $("#tabs").innerHTML = projects
    .map(
      (p) =>
        `<div class="tab ${p.id === activeId ? "active" : ""}"><button data-project="${p.id}">◈ &nbsp; ${esc(p.name)}</button><button data-close-project="${p.id}" title="Close project tab (export first to keep a portable copy)">×</button></div>`,
    )
    .join("");
}
function renderPages() {
  const search = $("#search").value.toLowerCase();
  $("#pages").innerHTML = current()
    .pages.filter((p) => p.name.toLowerCase().includes(search))
    .map(
      (p) =>
        `<div class="page ${p.id === pg().id ? "active" : ""}"><button data-page="${p.id}" title="Double-click to rename">▧ &nbsp;${esc(p.name)}</button><button class="delete-page" data-delete-page="${p.id}" title="Delete page">×</button></div>`,
    )
    .join("");
}
function renderLayers() {
  const search = $("#search").value.toLowerCase();
  const icons = {
    frame: "⊞",
    group: "▱",
    text: "T",
    image: "▧",
    comment: "◉",
    ellipse: "○",
    star: "☆",
  };
  function branch(parent, depth) {
    return nodes()
      .filter((n) => n.parent === parent && n.type !== "comment")
      .slice()
      .reverse()
      .map((n) => {
        const children = nodes().some((c) => c.parent === n.id);
        const match = !search || n.name.toLowerCase().includes(search);
        return `${match ? `<div class="layer ${selected.has(n.id) ? "selected" : ""} ${n.hidden ? "dim" : ""}" data-node="${n.id}" style="padding-left:${depth * 12 + 4}px"><button title="${collapsed.has(n.id) ? "Expand layers" : "Collapse layers"}" aria-label="${collapsed.has(n.id) ? "Expand layers" : "Collapse layers"}" data-fold="${n.id}" ${children ? "" : "disabled"}>${children ? (collapsed.has(n.id) ? "▸" : "▾") : "·"}</button><span>${icons[n.type] || "◇"}</span><span class="name">${esc(n.name)}</span><button data-locate="${n.id}" title="Locate layer · Zoom to fit" aria-label="Locate ${esc(n.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1"/></svg></button><button data-visible="${n.id}" title="${n.hidden ? "Show layer" : "Hide layer"}">${eyeIcon(n.hidden)}</button><button data-lock="${n.id}" title="${n.locked ? "Unlock layer" : "Lock layer"}">${lockIcon(n.locked)}</button></div>` : ""}${!collapsed.has(n.id) || search ? branch(n.id, depth + 1) : ""}`;
      })
      .join("");
  }
  $("#layers").innerHTML =
    branch(null, 0) ||
    '<div class="empty-layers">A fresh canvas.<br>Draw a shape or drop in a file.</div>';
}
function orderedNodes() {
  const result = [];
  function walk(parent) {
    for (const n of nodes().filter((n) => n.parent === parent)) {
      result.push(n);
      walk(n.id);
    }
  }
  walk(null);
  return result;
}
function renderCanvas() {
  const v = view();
  $("#world").style.transform = `translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
  $("#zoom").textContent = `${Math.round(v.zoom * 100)}%`;
  $("#viewport").style.backgroundColor = pg().background || "#202326";
  $("#viewport").style.backgroundSize = `${v.zoom}px ${v.zoom}px`;
  $("#viewport").style.backgroundImage =
    v.zoom >= 8
      ? "linear-gradient(#ffffff22 1px,transparent 1px),linear-gradient(90deg,#ffffff22 1px,transparent 1px)"
      : "none";
  $("#viewport").style.backgroundPosition = `${v.x}px ${v.y}px`;
  $("#viewport").style.cursor = space
    ? "grab"
    : tool === "move"
      ? "default"
      : "crosshair";
  const media = new Map(
    [...document.querySelectorAll("#world img,#world video,#world audio")].map(
      (el) => [el.closest("[data-id]").dataset.id, el],
    ),
  );
  const moving =
    gesture?.kind === "move"
      ? new Set(gesture.items.map((n) => n.id))
      : new Set();
  const ordered = orderedNodes();
  const displayOrder = moving.size
    ? [
        ...ordered.filter((n) => !moving.has(n.id)),
        ...ordered.filter((n) => moving.has(n.id)),
      ]
    : ordered;
  $("#world").innerHTML = displayOrder
    .filter((n) => !hidden(n))
    .map((n) => {
      let content = "";
      if (n.type === "text")
        content = `<svg viewBox="0 0 ${n.w} ${n.h}">${shapeSVG(n)}</svg>`;
      else if (n.type === "image")
        content = `<img src="${esc(imageURL(n, v.zoom, renderCanvas))}" alt="${esc(n.name)}" decoding="async">`;
      else if (n.type === "pdf")
        content = `<iframe sandbox src="${esc(n.src)}" title="${esc(n.name)}"></iframe>`;
      else if (n.type === "comment")
        content = `<div class="comment-pin">${esc((n.comments?.[0]?.author || "You").slice(0, 1).toUpperCase())}</div><div class="comment-preview">${esc(n.comments?.[0]?.text || "Comment")}</div>`;
      else if (["audio", "video"].includes(n.type))
        content = `<div class="attachment"><span class="file-icon">${n.type === "audio" ? "♫" : "▧"}</span><b>${esc(n.name)}</b><small>${esc(n.mime || n.type)} · Export to open or convert</small></div>`;
      else if (["file"].includes(n.type))
        content = `<div class="attachment"><span class="file-icon">${n.type === "audio" ? "♫" : "▧"}</span><b>${esc(n.name)}</b><small>${esc(n.mime || "Attachment")} · Double-click to open</small></div>`;
      else if (n.type === "group") content = "";
      else content = `<svg viewBox="0 0 ${n.w} ${n.h}">${shapeSVG(n)}</svg>`;
      return `<div class="node ${selected.has(n.id) ? "selected" : ""} ${canvasTarget(n).id !== n.id ? "container-protected" : ""}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;opacity:${n.opacity};filter:${n.shadow ? "drop-shadow(0px 6px 10px #35204433)" : "none"};transform:rotate(${n.rotation}deg) scale(${n.flipX ? -1 : 1},${n.flipY ? -1 : 1});${n.type === "group" ? "pointer-events:none;" : n.type === "comment" ? `transform:scale(${1 / v.zoom});transform-origin:top left;` : ""}">${["frame", "group"].includes(n.type) ? `<span class="frame-label">${esc(n.name)}</span>` : ""}${content}${editingId === n.id ? vectorOverlay(n) : ""}</div>`;
    })
    .join("");
  for (const [id, el] of media) {
    const fresh = $(`[data-id="${id}"] ${el.tagName.toLowerCase()}`);
    if (fresh && fresh.getAttribute("src") === el.getAttribute("src"))
      fresh.replaceWith(el);
  }
  renderCommentsPanel();
  for (const line of alignmentGuides) {
    const vertical = line.axis === "x";
    $("#world").insertAdjacentHTML(
      "beforeend",
      '<div class="alignment-guide" style="left:' +
        (vertical ? line.value : line.from) +
        "px;top:" +
        (vertical ? line.from : line.value) +
        "px;width:" +
        (vertical ? 1 / view().zoom : line.to - line.from) +
        "px;height:" +
        (vertical ? line.to - line.from : 1 / view().zoom) +
        'px"></div>',
    );
  }
  if (textEditor) positionTextEditor();
  if (dropTarget) {
    const n = nodes().find((n) => n.id === dropTarget);
    if (n)
      $("#world").insertAdjacentHTML(
        "beforeend",
        `<div class="drop-target" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px"><span>Place on top in ${esc(n.name)}</span></div>`,
      );
  }
  if (!editingId && !textEditor)
    for (const n of picked().filter(
      (n) => !hidden(n) && n.type !== "comment",
    )) {
      const b = visualBounds(n),
        z = view().zoom;
      $("#world").insertAdjacentHTML(
        "beforeend",
        `<div class="selection-box" data-id="${n.id}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;--unit:${1 / z}px"><span class="size-badge">${Math.round(n.w)} × ${Math.round(n.h)}</span>${!locked(n) ? '<span class="rotation-zone top-right" data-rotate="true"></span><span class="rotation-zone top-left" data-rotate="true"></span><span class="rotation-zone bottom-left" data-rotate="true"></span><span class="rotation-zone bottom-right" data-rotate="true"></span><span class="resize" data-resize="true"></span>' : ""}</div>`,
      );
    }
  for (const row of document.querySelectorAll("#layers .layer"))
    row.classList.toggle("drop-row", row.dataset.node === dropTarget);
  drawDraft();
  commentUI.position();
  $("#status").textContent = editingId
    ? "Vector editing · drag handles · click edge to add · Ctrl-drag edge to bend · Esc to finish"
    : selected.size
      ? `${selected.size} selected · ${tool === "pen" ? "Enter to finish path" : "Shift + click to add to selection"}`
      : tool === "pen"
        ? "Click to place points · Enter to finish · Escape to cancel"
        : `${nodes().length} layers · ${pg().name}`;
}
function field(label, key, value, type = "number", extra = "") {
  return `<label>${label}<input data-prop="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
function renderInspector() {
  const list = picked(),
    n = list[0];
  if (!n) {
    $("#inspector").innerHTML =
      `<div class="property-section"><h3>Your canvas, your rules.</h3><p>Select a layer to fine-tune it. Or start with a shape, a few words, or a file from your desktop.</p><button id="fit-content">⌗ Fit all content</button></div><div class="property-section"><h3>Project</h3><p>${current().pages.length} pages · ${nodes().length} layers on this page<br>Stored locally in this browser.</p><button id="open-project">Open .magic project</button></div><div class="property-section"><h3>A few handy shortcuts</h3><p>V &nbsp; Move and select<br>F &nbsp; Frame<br>R &nbsp; Shape<br>P &nbsp; Pen / Pencil<br>T &nbsp; Text<br>C &nbsp; Comment<br>Ctrl + G &nbsp; Group selection<br>Ctrl + S &nbsp; Save project<br>Delete &nbsp; Delete selection</p></div>`;
    return;
  }
  $("#inspector").innerHTML =
    `<div class="property-section"><h3>${list.length > 1 ? `${list.length} selected` : esc(n.type.toUpperCase())}</h3><input data-prop="name" value="${esc(n.name)}" aria-label="Layer name" style="width:100%"></div><div class="property-section"><h3>Position & dimensions</h3><div class="field-grid">${field("X", "x", Math.round(n.x))}${field("Y", "y", Math.round(n.y))}${field("Width", "w", Math.round(n.w), "number", 'min="1"')}${field("Height", "h", Math.round(n.h), "number", 'min="1"')}${field("Rotation °", "rotation", n.rotation)}${field("Opacity", "opacity", n.opacity, "number", 'min="0" max="1" step="0.1"')}</div></div>${list.length > 1 ? `<div class="property-section"><h3>Align selection</h3><div class="field-grid">${["Left", "Center", "Right", "Top", "Middle", "Bottom"].map((a) => `<button data-align="${a}">${a}</button>`).join("")}</div><button data-command="group">Group selection</button><button data-command="frame">Frame selection</button></div>` : ""}${n.type === "text" ? `<div class="property-section"><h3>Typography</h3><textarea data-prop="text" aria-label="Text content">${esc(n.text)}</textarea><div class="field-grid">${field("Size", "fontSize", n.fontSize || 24, "number", 'min="1"')}<label>Weight<select data-prop="fontWeight">${["400", "500", "600", "700", "800"].map((w) => `<option ${n.fontWeight === w ? "selected" : ""}>${w}</option>`).join("")}</select></label><label>Typeface<select data-prop="fontFamily">${["Arial", "Georgia", "Courier New", "Verdana"].map((f) => `<option ${n.fontFamily === f ? "selected" : ""}>${f}</option>`).join("")}</select></label><label>Alignment<select data-prop="align">${["left", "center", "right"].map((a) => `<option ${n.align === a ? "selected" : ""}>${a}</option>`).join("")}</select></label></div></div>` : ""}${!["file", "pdf", "image", "audio", "video", "comment", "group"].includes(n.type) ? `<div class="property-section"><h3>Appearance</h3><div class="field-grid">${field("Corner radius", "radius", n.radius || 0, "number", 'min="0"')}</div></div>` : ""}${!["file", "pdf", "image", "audio", "video", "comment", "group"].includes(n.type) ? paintSection(n, "fills") + paintSection(n, "strokes") : ""}${editingId === n.id ? `<div class="property-section"><h3>Vector editing</h3><p>Drag anchors and handles. Click an edge to add a point. Alt-click a point to remove it.</p><button id="curve-vertex" ${vertexIndex === null ? "disabled" : ""}>Toggle curve handles</button><button id="toggle-closed">${n.closed ? "Open path" : "Close path"}</button><button id="finish-vector">Done editing</button></div>` : ""}<div class="property-section"><h3>Layer actions</h3><button data-command="shadow">Toggle soft shadow</button><button data-command="duplicate">Duplicate</button>${["frame", "group"].includes(n.type) ? '<button data-command="ungroup">Release container</button>' : ""}${n.src ? '<button id="download-asset">Download original file</button>' : ""}${n.type === "comment" ? '<button id="open-comment">Open discussion</button>' : ""}<button data-command="delete">Delete layer</button></div>`;
  enhanceInspector({ n, project: current(), change, fitText, dialog, toast });
}
document.querySelector(".toolbar").addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) {
    e.preventDefault();
    $("#viewport").focus({ preventScroll: true });
  }
});
function setTool(t) {
  if (penPoints.length) finishPen();
  if (t !== "pen") editingId = null;
  tool = t;
  render();
}
function point(e) {
  const r = $("#viewport").getBoundingClientRect(),
    v = view();
  return {
    x: (e.clientX - r.left - v.x) / v.zoom,
    y: (e.clientY - r.top - v.y) / v.zoom,
  };
}
function autoParent(n) {
  const excluded = descendants(nodes(), [n.id]);
  const containers = nodes().filter(
    (c) => c.type === "frame" && !excluded.has(c.id) && contains(c, n),
  );
  n.parent = containers.sort((a, b) => a.w * a.h - b.w * b.h)[0]?.id || null;
}
function syncContainers() {
  for (let i = 0; i < 3; i++)
    for (const n of nodes().filter((n) => n.type === "group")) {
      const children = nodes().filter((c) => c.parent === n.id);
      if (children.length)
        Object.assign(n, bounds(children.map(visualBounds)), { rotation: 0 });
    }
}
function finishPen(closed = false) {
  if (penPoints.length < 2) {
    penPoints = [];
    return;
  }
  const xs = penPoints.map((p) => p.x),
    ys = penPoints.map((p) => p.y),
    x = Math.min(...xs),
    y = Math.min(...ys),
    w = Math.max(1, Math.max(...xs) - x),
    h = Math.max(1, Math.max(...ys) - y);
  change(() => {
    const n = node("vector", x, y, w, h, {
      closed,
      fill: "none",
      stroke: "#12cafd",
      strokeWidth: 3,
      vertices: penPoints.map((p) => ({
        x: (p.x - x) / w,
        y: (p.y - y) / h,
        ...(p.in ? { in: { x: (p.in.x - x) / w, y: (p.in.y - y) / h } } : {}),
        ...(p.out
          ? { out: { x: (p.out.x - x) / w, y: (p.out.y - y) / h } }
          : {}),
      })),
    });
    normalizeVector(n);
    autoParent(n);
    nodes().push(n);
    selected = new Set([n.id]);
  });
  penPoints = [];
  penHover = null;
  renderCanvas();
}
$("#viewport").addEventListener("pointerdown", (e) => {
  if (
    e.button === 2 ||
    e.target.closest("button,input,textarea,#inline-comment")
  )
    return;
  const mediaControl = e.target.closest("video,audio");
  if (mediaControl) {
    const asset = nodes().find(
      (n) => n.id === mediaControl.closest("[data-id]")?.dataset.id,
    );
    if (asset && canvasTarget(asset).id === asset.id) {
      selected = new Set([asset.id]);
      editingId = null;
      renderLayers();
      renderInspector();
      renderExport();
      return;
    }
  }
  if (e.target.closest(".interact")) return;
  $("#context-menu").hidden = true;
  if (textEditor && !e.target.closest("#live-text-editor"))
    textEditor.finish(true);
  if (document.activeElement?.matches("#inspector textarea"))
    $("#viewport").focus({ preventScroll: true });
  const p = point(e),
    hit = e.target.closest("[data-id]"),
    raw = nodes().find((n) => n.id === hit?.dataset.id);
  if (
    enteredContainer &&
    (!raw || !descendants(nodes(), [enteredContainer]).has(raw.id))
  )
    enteredContainer = null;
  const n = raw ? canvasTarget(raw) : null;
  if (
    !editingId &&
    n &&
    tool === "move" &&
    !space &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey &&
    !e.target.dataset.resize &&
    !e.target.dataset.rotate
  ) {
    const now = performance.now(),
      label = !!e.target.closest(".frame-label");
    if (
      lastCanvasClick?.id === n.id &&
      lastCanvasClick.label === label &&
      now - lastCanvasClick.time < 450 &&
      Math.hypot(e.clientX - lastCanvasClick.x, e.clientY - lastCanvasClick.y) <
        5
    ) {
      lastCanvasClick = null;
      lastCanvasDouble = performance.now();
      if (label) renameLayer(n, e.target.closest(".frame-label"));
      else if (["frame", "group"].includes(n.type)) enterContainer(n);
      else if (editableTypes.has(n.type)) beginVector(n);
      else openAsset(n);
      e.preventDefault();
      return;
    }
    lastCanvasClick = {
      id: n.id,
      label,
      time: now,
      x: e.clientX,
      y: e.clientY,
    };
  } else if (!n) lastCanvasClick = null;
  if (commentUI.active && n?.type !== "comment") commentUI.close();
  if (n?.type === "comment" && tool === "move") commentUI.open(n);
  if (editingId && !space && e.button !== 1) {
    handleVectorDown(e, p);
    e.preventDefault();
    return;
  }
  if (space || e.button === 1) {
    gesture = {
      kind: "pan",
      sx: e.clientX,
      sy: e.clientY,
      start: clone(view()),
    };
  } else if (tool === "move") {
    if (n && !locked(n)) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        selectLayer(n.id, e);
        render();
        return;
      }
      if (!selected.has(n.id)) selectLayer(n.id, e);
      checkpoint();
      const ids = descendants(nodes(), selected);
      gesture = {
        kind: e.target.dataset.rotate
          ? "rotate"
          : e.target.dataset.resize
            ? "resize"
            : "move",
        p,
        items: clone(nodes().filter((n) => ids.has(n.id))),
        target: n.id,
      };
      render();
    } else {
      if (!e.shiftKey) selected.clear();
      gesture = {
        kind: "marquee",
        p,
        base: new Set(selected),
        sx: e.clientX,
        sy: e.clientY,
      };
      render();
    }
  } else if (tool === "comment") {
    openNewComment(p);
    return;
  } else if (tool === "text") {
    change(() => {
      const n = node("text", p.x, p.y, 260, 60, {
        text: "Your next idea",
        fontSize: 32,
        fill: "#ffffff",
        strokeWidth: 0,
      });
      autoParent(n);
      nodes().push(n);
      selected = new Set([n.id]);
    });
    tool = "move";
    render();
    setTimeout(() => {
      const n = picked()[0];
      if (n?.type === "text") beginTextEdit(n);
    }, 0);
    return;
  } else if (tool === "pen" && $("#draw").value === "pen") {
    const snapped = snapPen(p);
    if (snapped.close && penPoints.length > 2) {
      finishPen(true);
      return;
    }
    penPoints.push({ x: snapped.x, y: snapped.y });
    gesture = { kind: "pen-handle", index: penPoints.length - 1, p: snapped };
    $("#viewport").setPointerCapture(e.pointerId);
    penHover = null;
    drawDraft();
    $("#status").textContent =
      `${penPoints.length} points · Enter to finish path`;
    return;
  } else {
    checkpoint();
    const type =
      tool === "frame"
        ? "frame"
        : tool === "pen"
          ? "pencil"
          : $("#shape").value;
    const n = node(type, p.x, p.y, 1, 1, {
      ...(type === "pencil" ? { strokeWidth: 3, fill: "none" } : {}),
    });
    nodes().push(n);
    selected = new Set([n.id]);
    gesture = { kind: "draw", p, id: n.id, points: [p] };
    render();
  }
  $("#viewport").setPointerCapture(e.pointerId);
  e.preventDefault();
});
$("#viewport").addEventListener("pointermove", (e) => {
  if (!gesture) {
    if (editingId) {
      const n = nodes().find((n) => n.id === editingId);
      edgeHover = e.target.closest("[data-vertex]")
        ? null
        : nearestEdge(n, localPoint(n, point(e)), view().zoom);
      if (edgeHover?.d > 12) edgeHover = null;
      const overlay = $(".vector-overlay");
      if (overlay) overlay.outerHTML = vectorOverlay(n);
    }
    if (penPoints.length) {
      penHover = snapPen(point(e));
      drawDraft();
    }
    return;
  }
  const g = gesture,
    p = point(e);
  if (g.kind === "pen-handle") {
    const anchor = penPoints[g.index];
    if (Math.hypot(p.x - g.p.x, p.y - g.p.y) * view().zoom > 3) {
      anchor.out = { x: p.x, y: p.y };
      anchor.in = { x: 2 * anchor.x - p.x, y: 2 * anchor.y - p.y };
    }
    drawDraft();
    return;
  }
  if (g.kind === "bend") {
    const n = nodes().find((n) => n.id === g.id),
      q = localPoint(n, p);
    bendEdge(n, g.index, g.t, { x: q.x - g.p.x, y: q.y - g.p.y }, g.original);
    renderCanvas();
    return;
  }
  if (g.kind === "vertex") {
    const n = nodes().find((n) => n.id === g.id),
      q = localPoint(n, p),
      v = n.vertices[g.index];
    if (g.handle) v[g.handle] = q;
    else {
      const dx = q.x - g.p.x,
        dy = q.y - g.p.y;
      v.x = g.start.x + dx;
      v.y = g.start.y + dy;
      for (const k of ["in", "out"])
        if (g.start[k]) v[k] = { x: g.start[k].x + dx, y: g.start[k].y + dy };
    }
    renderCanvas();
    return;
  }
  if (g.kind === "pan") {
    view().x = g.start.x + e.clientX - g.sx;
    view().y = g.start.y + e.clientY - g.sy;
    renderCanvas();
  } else if (g.kind === "move") {
    for (const start of g.items) {
      const n = nodes().find((n) => n.id === start.id);
      n.x = start.x + p.x - g.p.x;
      n.y = start.y + p.y - g.p.y;
    }
    const roots = g.items.filter(
      (n) => !g.items.some((p) => p.id === n.parent),
    );
    const excluded = new Set(g.items.map((n) => n.id));
    const box = bounds(
      roots.map((start) =>
        visualBounds(nodes().find((n) => n.id === start.id)),
      ),
    );
    const snap = snapBounds(
      box,
      guideTargets(excluded),
      view().zoom,
      false,
      e.altKey,
    );
    alignmentGuides = snap.lines;
    for (const start of g.items) {
      const n = nodes().find((n) => n.id === start.id);
      n.x += snap.dx;
      n.y += snap.dy;
    }
    dropTarget =
      nodes()
        .filter(
          (n) =>
            n.type === "frame" &&
            !excluded.has(n.id) &&
            !hidden(n) &&
            !locked(n) &&
            p.x >= n.x &&
            p.x <= n.x + n.w &&
            p.y >= n.y &&
            p.y <= n.y + n.h,
        )
        .sort((a, b) => a.w * a.h - b.w * b.h)[0]?.id || null;
    renderCanvas();
  } else if (g.kind === "rotate") {
    const origin = g.items.find((n) => n.id === g.target),
      cx = origin.x + origin.w / 2,
      cy = origin.y + origin.h / 2;
    let delta =
      ((Math.atan2(p.y - cy, p.x - cx) - Math.atan2(g.p.y - cy, g.p.x - cx)) *
        180) /
      Math.PI;
    if (e.shiftKey) delta = Math.round(delta / 15) * 15;
    for (const start of g.items) {
      const n = nodes().find((n) => n.id === start.id),
        a = (delta * Math.PI) / 180,
        dx = start.x + start.w / 2 - cx,
        dy = start.y + start.h / 2 - cy;
      n.rotation = (start.rotation || 0) + delta;
      n.x = cx + dx * Math.cos(a) - dy * Math.sin(a) - start.w / 2;
      n.y = cy + dx * Math.sin(a) + dy * Math.cos(a) - start.h / 2;
    }
    renderCanvas();
  } else if (g.kind === "resize") {
    const n = nodes().find((n) => n.id === g.target),
      original = g.items.find((n) => n.id === g.target);
    Object.assign(
      n,
      resizeUpright(
        original,
        p.x - g.p.x,
        p.y - g.p.y,
        e.shiftKey && n.type !== "text",
      ),
    );
    const snap = snapBounds(
      visualBounds(n),
      guideTargets(new Set(g.items.map((n) => n.id))),
      view().zoom,
      true,
      e.altKey,
    );
    alignmentGuides = snap.lines;
    if (!e.altKey)
      Object.assign(
        n,
        resizeUpright(n, snap.dx, snap.dy, e.shiftKey && n.type !== "text"),
      );
    if (n.type === "text")
      fitText(n, Math.abs(p.x - g.p.x) < Math.abs(p.y - g.p.y) ? "h" : "w");
    renderCanvas();
  } else if (g.kind === "draw") {
    const n = nodes().find((n) => n.id === g.id);
    if (n.type === "pencil") {
      g.points.push(p);
      const b = bounds(g.points.map((p) => ({ ...p, w: 0, h: 0 })));
      Object.assign(n, b, { w: Math.max(1, b.w), h: Math.max(1, b.h) });
      n.points = g.points.map((p) => [(p.x - n.x) / n.w, (p.y - n.y) / n.h]);
    } else {
      n.x = Math.min(p.x, g.p.x);
      n.y = Math.min(p.y, g.p.y);
      n.w = Math.max(1, Math.abs(p.x - g.p.x));
      n.h = Math.max(1, Math.abs(p.y - g.p.y));
      if (e.shiftKey) n.h = n.w;
    }
    renderCanvas();
  } else if (g.kind === "marquee") {
    const r = $("#viewport").getBoundingClientRect();
    Object.assign($("#marquee").style, {
      display: "block",
      left: Math.min(g.sx, e.clientX) - r.left + "px",
      top: Math.min(g.sy, e.clientY) - r.top + "px",
      width: Math.abs(e.clientX - g.sx) + "px",
      height: Math.abs(e.clientY - g.sy) + "px",
    });
    const box = {
      x: Math.min(p.x, g.p.x),
      y: Math.min(p.y, g.p.y),
      w: Math.abs(p.x - g.p.x),
      h: Math.abs(p.y - g.p.y),
    };
    selected = new Set([
      ...g.base,
      ...nodes()
        .filter(
          (n) => !hidden(n) && !locked(n) && intersects(box, visualBounds(n)),
        )
        .map((n) => canvasTarget(n).id),
    ]);
    renderCanvas();
  }
});
function finishGesture() {
  if (!gesture) return;
  const g = gesture;
  alignmentGuides = [];
  clearPageHover();
  if (g.kind === "pen-handle") {
    gesture = null;
    drawDraft();
    return;
  }
  if (["vertex", "bend"].includes(g.kind))
    normalizeVector(nodes().find((n) => n.id === g.id));
  if (g.kind === "draw") {
    const n = nodes().find((n) => n.id === g.id);
    if (n.type !== "pencil" && n.w < 5 && n.h < 5) {
      n.w = 100;
      n.h = 100;
    }
    autoParent(n);
    if (n.type === "frame")
      for (const child of nodes())
        if (child.id !== n.id && !child.parent && contains(n, child))
          child.parent = n.id;
    if (n.type !== "pencil") tool = "move";
  }
  if (
    g.kind === "move" &&
    Math.hypot(
      ...g.items.slice(0, 1).flatMap((i) => {
        const n = nodes().find((n) => n.id === i.id);
        return [n.x - i.x, n.y - i.y];
      }),
    ) > 0.1
  )
    for (const n of picked())
      if (!g.items.some((i) => i.id === n.parent)) {
        if (dropTarget) {
          n.parent = dropTarget;
          n.hidden = false;
          const i = nodes().indexOf(n);
          nodes().splice(i, 1);
          nodes().push(n);
        } else if (!n.parent) autoParent(n);
      }
  dropTarget = null;
  syncContainers();
  gesture = null;
  $("#marquee").style.display = "none";
  render();
  save();
}
$("#viewport").addEventListener("pointerup", finishGesture);
$("#viewport").addEventListener("pointercancel", finishGesture);
$("#viewport").addEventListener(
  "wheel",
  (e) => {
    if (e.target.closest("textarea,input,audio,video")) return;
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.001), e.clientX, e.clientY);
  },
  { passive: false },
);
function zoomAt(factor, cx, cy) {
  const r = $("#viewport").getBoundingClientRect();
  cx ??= r.left + r.width / 2;
  cy ??= r.top + r.height / 2;
  const p = point({ clientX: cx, clientY: cy }),
    v = view();
  v.zoom = Math.min(64, Math.max(0.1, v.zoom * factor));
  v.x = cx - r.left - p.x * v.zoom;
  v.y = cy - r.top - p.y * v.zoom;
  renderCanvas();
  save();
}
function locateLayer(id) {
  const n = nodes().find((n) => n.id === id);
  if (!n) return;
  if (hidden(n)) {
    checkpoint();
    let ancestor = n;
    while (ancestor) {
      ancestor.hidden = false;
      ancestor = nodes().find((item) => item.id === ancestor.parent);
    }
  }
  const b = visualBounds(n),
    r = $("#viewport").getBoundingClientRect(),
    v = view();
  v.zoom = Math.min(
    64,
    Math.max(
      0.0001,
      Math.min(
        Math.max(1, r.width - 112) / Math.max(1, b.w),
        Math.max(1, r.height - 160) / Math.max(1, b.h),
      ),
    ),
  );
  v.x = (r.width - b.w * v.zoom) / 2 - b.x * v.zoom;
  v.y = (r.height - 64 - b.h * v.zoom) / 2 - b.y * v.zoom;
  enteredContainer = n.parent || null;
  editingId = null;
  selected = new Set([n.id]);
  tool = "move";
  render();
  save();
}
function fit() {
  const b = bounds(nodes().filter((n) => !hidden(n))),
    r = $("#viewport").getBoundingClientRect(),
    v = view();
  v.zoom = Math.max(
    0.1,
    Math.min(1.5, (r.width - 120) / b.w, (r.height - 160) / b.h),
  );
  v.x = (r.width - b.w * v.zoom) / 2 - b.x * v.zoom;
  v.y = (r.height - 80 - b.h * v.zoom) / 2 - b.y * v.zoom;
  renderCanvas();
  save();
}
function download(name, data, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function saveProject() {
  download(
    current().name.replace(/[<>:"/\\|?*]/g, "_") + ".magic",
    JSON.stringify(
      { format: "magic", version: 3, project: current() },
      null,
      2,
    ),
    "application/json",
  );
  toast("Project exported with embedded assets.");
}
function exportNodes() {
  const ids = selected.size
    ? descendants(nodes(), selected)
    : new Set(nodes().map((n) => n.id));
  return orderedNodes().filter((n) => ids.has(n.id) && !hidden(n));
}
async function exportPNG(flatten = false, format = "PNG") {
  await loadFonts(current());
  const list = exportNodes();
  if (
    list.some((n) =>
      ["pdf", "file", "video", "audio", "comment"].includes(n.type),
    )
  ) {
    toast(
      "Image exports support shapes, text and images. Exclude attachments and comments first.",
    );
    return;
  }
  const svg = exportSVG(list),
    img = new Image(),
    url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise((ok, no) => {
      img.onload = ok;
      img.onerror = no;
      img.src = url;
    });
    if (img.width * img.height > 32000000)
      throw Error("Export is too large. Reduce the canvas extent.");
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (format === "JPEG" || format === "PDF") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);
    if (flatten) {
      const b = bounds(list);
      change(() => {
        const ids = descendants(nodes(), selected);
        pg().nodes = nodes().filter((n) => !ids.has(n.id));
        const n = node("image", b.x, b.y, img.width, img.height, {
          src: canvas.toDataURL(),
          name: "Flattened selection",
          strokeWidth: 0,
        });
        nodes().push(n);
        selected = new Set([n.id]);
      });
    } else {
      const mime = format === "PNG" ? "image/png" : "image/jpeg";
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, mime, 0.95),
      );
      if (!blob) throw Error("Image encoding failed");
      if (format === "PDF") {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        download(
          pg().name + ".pdf",
          rasterPDF(canvas.width, canvas.height, bytes),
          "application/pdf",
        );
      } else
        download(pg().name + (format === "JPEG" ? ".jpg" : ".png"), blob, mime);
    }
  } catch (e) {
    toast(e.message || "Could not render this export.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
function command(cmd) {
  if (cmd === "enter") {
    enterContainer(picked()[0]);
    return;
  }
  if (cmd === "vector") {
    beginVector(picked()[0]);
    return;
  }
  if (cmd === "rename") {
    const n = picked()[0];
    if (n) {
      const row = $(`[data-node="${n.id}"] .name`);
      if (row) renameLayer(n, row);
    }
    return;
  }
  if (cmd === "copy") {
    clipboard = copyNodes(nodes(), selected, 0);
    toast("Selection copied inside Magic.");
    return;
  }
  if (cmd === "paste" || cmd === "replace") {
    if (!clipboard.length) return;
    change(() => {
      const copies = copyNodes(
        clipboard,
        clipboard.filter((n) => !n.parent).map((n) => n.id),
      );
      if (cmd === "replace" && picked().length) {
        const a = bounds(picked()),
          b = bounds(copies);
        copies.forEach((n) => {
          n.x += a.x - b.x;
          n.y += a.y - b.y;
        });
        const ids = descendants(nodes(), selected);
        pg().nodes = nodes().filter((n) => !ids.has(n.id));
      }
      nodes().push(...copies);
      selected = new Set(copies.filter((n) => !n.parent).map((n) => n.id));
    });
    return;
  }
  if (!selected.size) return;
  if (
    !["lock", "hide", "copy", "duplicate"].includes(cmd) &&
    picked().some(locked)
  ) {
    toast("Unlock the selected layers before editing them.");
    return;
  }
  if (cmd === "flatten") {
    exportPNG(true);
    return;
  }
  change(() => {
    const list = picked(),
      ids = descendants(nodes(), selected),
      all = nodes().filter((n) => ids.has(n.id));
    if (cmd === "delete") {
      pg().nodes = nodes().filter((n) => !ids.has(n.id));
      selected.clear();
    } else if (cmd === "duplicate") {
      const originals = nodes().filter((n) => ids.has(n.id)),
        roots = originals.filter((n) => !ids.has(n.parent));
      const ancestors = new Set();
      for (const root of roots) {
        let parent = nodes().find((n) => n.id === root.parent);
        while (parent) {
          ancestors.add(parent.id);
          parent = nodes().find((n) => n.id === parent.parent);
        }
      }
      const box = bounds(roots.map(visualBounds)),
        dx = duplicateOffset(
          box,
          nodes()
            .filter((n) => !ancestors.has(n.id) && n.type !== "comment")
            .map(visualBounds),
        );
      const copies = copyNodes(nodes(), selected, 0);
      copies.forEach((copy, i) => {
        copy.x += dx;
        if (!ids.has(originals[i].parent)) copy.parent = originals[i].parent;
      });
      nodes().push(...copies);
      selected = new Set(
        copies
          .filter((n) => !copies.some((p) => p.id === n.parent))
          .map((n) => n.id),
      );
    } else if (cmd === "group" || cmd === "frame") {
      const b = bounds(list),
        container = node(cmd, b.x - 16, b.y - 16, b.w + 32, b.h + 32, {
          name: cmd === "frame" ? "New frame" : "New group",
          fill: "#ffffff",
          strokeWidth: 0,
          parent: list.every((n) => n.parent === list[0].parent)
            ? list[0].parent
            : null,
        });
      nodes().unshift(container);
      list
        .filter((n) => !ids.has(n.parent))
        .forEach((n) => (n.parent = container.id));
      selected = new Set([container.id]);
    } else if (cmd === "ungroup") {
      for (const n of list.filter((n) => ["frame", "group"].includes(n.type))) {
        nodes()
          .filter((c) => c.parent === n.id)
          .forEach((c) => (c.parent = n.parent));
        pg().nodes = nodes().filter((c) => c.id !== n.id);
      }
      selected.clear();
    } else if (cmd === "front" || cmd === "back") {
      const rest = nodes().filter((n) => !ids.has(n.id));
      pg().nodes = cmd === "front" ? [...rest, ...all] : [...all, ...rest];
    } else if (cmd === "shadow") list.forEach((n) => (n.shadow = !n.shadow));
    else if (cmd === "hide")
      list.forEach((n) => setBranchVisibility(n, !n.hidden));
    else if (cmd === "lock") list.forEach((n) => (n.locked = !n.locked));
    else if (cmd === "flip-x" || cmd === "flip-y") {
      const key = cmd === "flip-x" ? "flipX" : "flipY";
      all
        .filter((n) => !["frame", "group"].includes(n.type))
        .forEach((n) => (n[key] = !n[key]));
    }
    syncContainers();
  });
}
function menu(e, layerMenu = false) {
  e.preventDefault();
  const hit = e.target.closest("[data-id]");
  const menuNode = hit
    ? canvasTarget(nodes().find((n) => n.id === hit.dataset.id))
    : null;
  if (menuNode && !selected.has(menuNode.id)) {
    selected = new Set([menuNode.id]);
    render();
  }
  const onLayer = layerMenu || !!hit;
  if (!onLayer) {
    selected.clear();
    editingId = null;
    render();
  }
  const items = onLayer
    ? [
        ["rename", "Rename", "F2"],
        ...(picked().length === 1 &&
        ["group", "frame"].includes(picked()[0].type)
          ? [["enter", "Enter container", "Double-click"]]
          : []),
        ["vector", "Edit vector points", "Double-click"],
        ["shadow", "Toggle soft shadow", ""],
        ["copy", "Copy", "Ctrl C"],
        ["paste", "Paste", "Ctrl V"],
        ["replace", "Paste to replace", ""],
        ["duplicate", "Duplicate", "Ctrl D"],
        ["front", "Bring to front", "]"],
        ["back", "Send to back", "["],
        ["group", "Group selection", "Ctrl G"],
        ["ungroup", "Ungroup / release container", "Ctrl Shift G"],
        ["frame", "Frame selection", ""],
        ["flatten", "Flatten to image", ""],
        ["hide", "Show / hide", ""],
        ["lock", "Lock / unlock", ""],
        ["flip-x", "Flip horizontal", ""],
        ["flip-y", "Flip vertical", ""],
        ["delete", "Delete", "Del"],
      ]
    : [["paste", "Paste", "Ctrl V"]];
  $("#context-menu").innerHTML =
    items
      .map(
        ([cmd, label, key]) =>
          `<button data-command="${cmd}">${label}<kbd>${key}</kbd></button>`,
      )
      .join("") +
    (onLayer
      ? ""
      : '<button id="context-actions">Actions</button><button id="customize-canvas">Customize</button>');
  $("#context-menu").hidden = false;
  $("#context-menu").style.left = Math.min(e.clientX, innerWidth - 230) + "px";
  $("#context-menu").style.top =
    Math.max(
      5,
      Math.min(e.clientY, innerHeight - $("#context-menu").offsetHeight - 10),
    ) + "px";
}
$("#viewport").addEventListener("contextmenu", menu);
function dialog(html) {
  $("#dialog-content").innerHTML = html;
  if (!$("#dialog").open) $("#dialog").showModal();
}
function openNewComment(p) {
  commentUI.openNew(p);
}
function openComment(n) {
  commentUI.open(n);
}
function openAsset(n) {
  if (n.type === "comment") return openComment(n);
  if (n.type === "image" && /-traced\.svg$/i.test(n.name))
    return editLegacyTrace(n);
  if (n.type === "text") return beginTextEdit(n);
  if (["audio", "video"].includes(n.type)) {
    toast("Use Export to save the original or convert this media file.");
    return;
  }
  if (n.type === "pdf") {
    const el = $(`[data-id="${n.id}"]`);
    el.classList.add("interact");
    toast("Preview active. Click elsewhere to return to editing.");
  } else if (n.src) {
    const a = document.createElement("a");
    a.href = n.src;
    a.download = n.name;
    a.click();
  }
}
async function editLegacyTrace(n) {
  const pageId = pg().id;
  try {
    const c = await imageCanvas(n, 2048),
      data = c.getContext("2d").getImageData(0, 0, c.width, c.height),
      result = tracePixels(data.data, c.width, c.height, 128, "auto");
    if (pg().id !== pageId) return;
    change(() => {
      n.type = "vector";
      n.vertices = result.vertices;
      n.closed = true;
      n.fill = result.color;
      n.strokeWidth = 0;
      delete n.src;
      delete n.mime;
      delete n.fills;
      delete n.strokes;
    });
    beginVector(n);
  } catch (e) {
    toast(e.message || "Could not edit this older trace.");
  }
}
$("#viewport").addEventListener("dblclick", (e) => {
  if (
    performance.now() - lastCanvasDouble < 500 ||
    e.target.closest("audio,video,textarea,input")
  )
    return;
  const n = nodes().find(
    (n) => n.id === e.target.closest("[data-id]")?.dataset.id,
  );
  if (!n) return;
  if (editingId === n.id || e.target.closest("input")) return;
  if (e.target.closest(".frame-label"))
    renameLayer(n, e.target.closest(".frame-label"));
  else if (["frame", "group"].includes(canvasTarget(n).type))
    enterContainer(canvasTarget(n));
  else if (editableTypes.has(n.type)) beginVector(n);
  else openAsset(n);
});
async function importFiles(files, at) {
  const target = pg(),
    projectId = activeId,
    base = at || { x: 100, y: 100 },
    added = [];
  for (const [i, file] of [...files].entries()) {
    if (/\.(magic|json)$/i.test(file.name)) {
      try {
        const data = JSON.parse(await file.text());
        if (data.format === "magic") {
          if (![1, 2, 3].includes(data.version))
            throw Error("Unsupported Magic project version");
          const p = validateProject(data.project);
          p.id = uid();
          change(() => {
            projects.push(p);
            activeId = p.id;
            selected.clear();
          });
          continue;
        }
      } catch (e) {
        toast(`Could not import project: ${e.message}`);
        continue;
      }
    }
    const src = await new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = no;
      r.readAsDataURL(file);
    });
    const type = file.type.startsWith("image/")
      ? "image"
      : file.type === "application/pdf"
        ? "pdf"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "file";
    let w = 280,
      h = type === "pdf" ? 360 : 180;
    if (type === "image") {
      try {
        const img = new Image();
        await new Promise((ok, no) => {
          img.onload = ok;
          img.onerror = no;
          img.src = src;
        });
        w = Math.min(500, img.naturalWidth);
        h = (w * img.naturalHeight) / img.naturalWidth;
        await cacheImage(src, img, file);
      } catch {
        toast(`Image preview unavailable: ${file.name}`);
      }
    }
    added.push(
      node(type, base.x, base.y, w, h, {
        name: file.name,
        src,
        mime: file.type,
        strokeWidth: 0,
      }),
    );
  }
  if (added.length) {
    let x = base.x,
      y = base.y,
      rowHeight = 0;
    const rowWidth = Math.max(
      500,
      ($("#viewport").clientWidth - 100) / view().zoom,
    );
    for (const item of added) {
      if (x > base.x && x + item.w > base.x + rowWidth) {
        x = base.x;
        y += rowHeight + 10;
        rowHeight = 0;
      }
      item.x = x;
      item.y = y;
      for (let pass = 0; pass <= target.nodes.length; pass++) {
        const hit = target.nodes.find(
          (n) =>
            n.type !== "comment" &&
            (() => {
              const b = visualBounds(n);
              return (
                item.x < b.x + b.w + 10 &&
                item.x + item.w + 10 > b.x &&
                item.y < b.y + b.h + 10 &&
                item.y + item.h + 10 > b.y
              );
            })(),
        );
        if (!hit) break;
        item.x = visualBounds(hit).x + visualBounds(hit).w + 10;
      }
      x = item.x + item.w + 10;
      rowHeight = Math.max(rowHeight, item.h);
    }
    change(() => {
      target.nodes.push(...added);
      if (activeId === projectId && pg().id === target.id)
        selected = new Set(added.map((n) => n.id));
    });
    toast(`${added.length} file${added.length === 1 ? "" : "s"} imported.`);
  }
}
$("#viewport").addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
});
$("#viewport").addEventListener("drop", (e) => {
  e.preventDefault();
  importFiles(e.dataTransfer.files, point(e)).catch(() =>
    toast("File import failed."),
  );
});
$("#file-input").onchange = (e) => {
  importFiles(e.target.files).catch(() => toast("File import failed."));
  e.target.value = "";
};
$("#project-input").onchange = (e) => {
  importFiles(e.target.files).catch(() => toast("Project import failed."));
  e.target.value = "";
};
let liveTypographyInput = null;
$("#inspector").addEventListener("input", (e) => {
  if (e.target.dataset.prop !== "text") return;
  const target = e.target;
  if (liveTypographyInput !== target) {
    checkpoint();
    liveTypographyInput = target;
  }
  for (const n of picked().filter((n) => n.type === "text" && !locked(n))) {
    n.text = target.value;
    fitText(n);
    if (textEditor?.id === n.id) textEditor.input.value = n.text;
  }
  renderCanvas();
  save();
});
$("#inspector").addEventListener("focusout", () => {
  liveTypographyInput = null;
});
$("#inspector").addEventListener("change", (e) => {
  const key = e.target.dataset.prop;
  if (!key) return;
  if (key === "text") {
    save();
    return;
  }
  const value =
    e.target.type === "number" ? Number(e.target.value) : e.target.value;
  if (e.target.type === "number" && !Number.isFinite(value)) return;
  if (["w", "h", "fontSize"].includes(key) && value <= 0) return;
  if (key === "opacity" && (value < 0 || value > 1)) return;
  change(() => {
    for (const n of picked()) {
      if (locked(n)) continue;
      if (["x", "y"].includes(key) && ["frame", "group"].includes(n.type)) {
        const delta = value - n[key];
        nodes()
          .filter(
            (c) => descendants(nodes(), [n.id]).has(c.id) && c.id !== n.id,
          )
          .forEach((c) => (c[key] += delta));
      }
      n[key] = key === "parent" ? value || null : value;
      if (n.type === "text") fitText(n, key);
    }
    syncContainers();
  });
});
$("#project-name").onchange = (e) =>
  change(() => (current().name = e.target.value.trim() || "Untitled project"));
$("#search").oninput = () => {
  renderPages();
  renderLayers();
};
$("#shape").onchange = () => setTool("shape");
$("#draw").onchange = () => setTool("pen");
document.addEventListener("click", (e) => {
  if (!e.target.closest(".interact"))
    $$(".interact").forEach((n) => n.classList.remove("interact"));
  const b = e.target.closest("button");
  if (!b) {
    if (!e.target.closest(".menu")) $("#context-menu").hidden = true;
    return;
  }
  const d = b.dataset;
  if (d.tool) setTool(d.tool);
  if (d.project) {
    activeId = d.project;
    selected.clear();
    render();
    save();
  }
  if (d.closeProject) {
    dialog(
      '<h2>Close this project?</h2><p>Closing removes it from this browser workspace. Export a project file first to keep a copy. You can undo closing during this session.</p><button id="export-before-close">Save project file</button><button class="primary" id="confirm-close">Close project</button>',
    );
    $("#export-before-close").onclick = () => {
      const previous = activeId;
      activeId = d.closeProject;
      saveProject();
      activeId = previous;
    };
    $("#confirm-close").onclick = () => {
      change(() => {
        projects = projects.filter((p) => p.id !== d.closeProject);
        if (!projects.length) projects.push(project());
        if (activeId === d.closeProject) activeId = projects[0].id;
        selected.clear();
      });
      $("#dialog").close();
    };
  }
  if (d.page) {
    const now = performance.now();
    if (lastPageClick?.id === d.page && now - lastPageClick.time < 450) {
      lastPageClick = null;
      renamePage(
        current().pages.find((p) => p.id === d.page),
        $('[data-page="' + d.page + '"]'),
      );
      return;
    }
    lastPageClick = { id: d.page, time: now };
  }
  if (d.page && current().activePage !== d.page) {
    current().activePage = d.page;
    selected.clear();
    render();
    save();
  }
  if (d.deletePage) {
    if (current().pages.length === 1) {
      toast("Keep at least one page in a project.");
      return;
    }
    change(() => {
      current().pages = current().pages.filter((p) => p.id !== d.deletePage);
      selected.clear();
    });
  }
  if (d.fold) {
    collapsed.has(d.fold) ? collapsed.delete(d.fold) : collapsed.add(d.fold);
    renderLayers();
  }
  if (b.id === "comments-toggle") {
    commentsPanelOpen = !commentsPanelOpen;
    renderCommentsPanel();
  }
  if (b.id === "comments-close") {
    commentsPanelOpen = false;
    renderCommentsPanel();
  }
  if (d.commentThread) {
    if (textEditor) textEditor.finish(true);
    current().activePage = d.commentPage;
    enteredContainer = null;
    selected.clear();
    render();
    const n = nodes().find((n) => n.id === d.commentThread);
    if (n) {
      const v = view(),
        r = $("#viewport").getBoundingClientRect();
      v.x = r.width / 2 - n.x * v.zoom;
      v.y = r.height / 2 - n.y * v.zoom;
      render();
      commentUI.open(n);
      save();
    }
  }
  if (d.locate) locateLayer(d.locate);
  if (d.visible || d.lock)
    change(() => {
      const n = nodes().find((n) => n.id === (d.visible || d.lock));
      const key = d.visible ? "hidden" : "locked";
      if (key === "hidden") setBranchVisibility(n, !n.hidden);
      else n[key] = !n[key];
    });
  if (d.command) {
    command(d.command);
    $("#context-menu").hidden = true;
  }
  if (d.align) {
    change(() => {
      const list = picked().filter((n) => !locked(n)),
        b = bounds(list);
      for (const n of list) {
        const ox = n.x,
          oy = n.y;
        if (d.align === "Left") n.x = b.x;
        if (d.align === "Center") n.x = b.x + (b.w - n.w) / 2;
        if (d.align === "Right") n.x = b.x + b.w - n.w;
        if (d.align === "Top") n.y = b.y;
        if (d.align === "Middle") n.y = b.y + (b.h - n.h) / 2;
        if (d.align === "Bottom") n.y = b.y + b.h - n.h;
        const children = descendants(nodes(), [n.id]);
        nodes()
          .filter(
            (c) => c.id !== n.id && children.has(c.id) && !selected.has(c.id),
          )
          .forEach((c) => {
            c.x += n.x - ox;
            c.y += n.y - oy;
          });
      }
      syncContainers();
    });
  }
  const actions = {
    "new-project": () =>
      change(() => {
        const p = project(`Untitled project ${projects.length + 1}`);
        projects.push(p);
        activeId = p.id;
        selected.clear();
      }),
    "new-page": () =>
      change(() => {
        const p = page(`Page ${current().pages.length + 1}`);
        current().pages.push(p);
        current().activePage = p.id;
        selected.clear();
      }),
    collapse: () => {
      if (collapsed.size) collapsed.clear();
      else
        nodes()
          .filter((n) => ["frame", "group"].includes(n.type))
          .forEach((n) => collapsed.add(n.id));
      renderLayers();
    },
    "search-toggle": () => $("#search").focus(),
    undo: () => restore(history, future),
    redo: () => restore(future, history),
    "zoom-in": () => zoomAt(1.2),
    "zoom-out": () => zoomAt(1 / 1.2),
    zoom: fit,
    "fit-content": fit,
    "save-project": saveProject,
    import: () => $("#file-input").click(),
    "open-project": () => $("#project-input").click(),
    "dialog-close": () => $("#dialog").close(),
    "export-svg": () => {
      const list = exportNodes();
      if (
        list.some((n) =>
          ["pdf", "video", "audio", "file", "comment"].includes(n.type),
        )
      )
        toast(
          "SVG export includes shapes, text and images; attachments and comments are omitted.",
        );
      download(pg().name + ".svg", exportSVG(list), "image/svg+xml");
    },
    "export-png": () => exportPNG(),
    "download-asset": () => openAssetDownload(picked()[0]),
    "open-comment": () => openComment(picked()[0]),
    actions: openActions,
    help: openHelp,
    updates: checkUpdates,
  };
  actions[b.id]?.();
});
function openAssetDownload(n) {
  const a = document.createElement("a");
  a.href = n.src;
  a.download = n.name;
  a.click();
}
$("#layers").addEventListener("click", (e) => {
  if (e.target.closest("button,input")) return;
  const id = e.target.closest("[data-node]")?.dataset.node;
  if (!id) return;
  const now = performance.now();
  if (
    lastTreeClick?.id === id &&
    now - lastTreeClick.time < 450 &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.metaKey
  ) {
    lastTreeClick = null;
    renameLayer(
      nodes().find((n) => n.id === id),
      e.target.closest("[data-node]").querySelector(".name"),
    );
    return;
  }
  lastTreeClick = { id, time: now };
  selectLayer(id, e, true);
  render();
});
$("#pages").addEventListener("dblclick", (e) => {
  const button = e.target.closest("[data-page]");
  if (button)
    renamePage(
      current().pages.find((p) => p.id === button.dataset.page),
      button,
    );
});
function renamePage(page, button) {
  if (!page || !button || $("#pages .inline-name")) return;
  const input = document.createElement("input");
  input.className = "inline-name";
  input.setAttribute("aria-label", "Rename page");
  input.value = page.name;
  button.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    if (commit && input.value.trim())
      change(() => (page.name = input.value.trim()));
    else renderPages();
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true);
    }
    if (e.key === "Escape") finish(false);
  };
  input.onkeyup = (e) => e.stopPropagation();
  input.onpointerdown = (e) => e.stopPropagation();
  input.onclick = (e) => e.stopPropagation();
  input.onblur = () => finish(true);
}
async function imageCanvas(n, maxSide = 2048) {
  const image = new Image();
  await new Promise((ok, no) => {
    image.onload = ok;
    image.onerror = () => no(Error("Could not read this image"));
    image.src = n.src;
  });
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
function traceDialog() {
  const source = picked()[0],
    target = pg();
  if (source?.type !== "image") {
    toast("Select an image first.");
    return;
  }
  dialog(
    '<h2>Image to editable vectors</h2><p>Adjust smoothing and detail removal to reduce anchors. Colors are quantized into editable layers; the original stays intact.</p><p class="trace-explanation">Color keeps image colors. Existing transparency outline traces opaque pixels as one shape; a photo without transparency becomes a rectangle. Dark silhouette traces dark pixels. Neither silhouette mode removes a photo background.</p><div class="trace-fields"><label>Mode<select id="trace-mode"><option value="color">Color</option><option value="alpha">Existing transparency outline</option><option value="dark">Dark silhouette</option></select></label><label>Colors<input id="trace-colors" type="number" min="2" max="64" value="16"></label><label>Smoothing (pixels)<input id="trace-smoothing" type="number" min="0.5" max="30" step="0.5" value="3"></label><label>Remove details smaller than (contour pixels)<input id="trace-detail" type="number" min="0" max="1000" value="24"></label><label>Resolution<select id="trace-resolution"><option>512</option><option selected>1024</option><option>2048</option></select></label><label>Silhouette threshold<input id="threshold" type="range" min="1" max="254" value="128"></label></div><div id="trace-preview" style="max-height:200px;overflow:auto"></div><p id="trace-count"></p><button id="trace-preview-button">Preview / recalculate</button><button id="trace" class="primary">Create editable vectors</button>',
  );
  let worker;
  const calculate = async () => {
    worker?.terminate();
    const c = await imageCanvas(source, Number($("#trace-resolution").value)),
      pixels = c.getContext("2d").getImageData(0, 0, c.width, c.height);
    worker = new Worker(new URL("./trace-worker.js", import.meta.url));
    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        worker.terminate();
        e.data.error ? reject(Error(e.data.error)) : resolve(e.data.layers);
      };
      worker.onerror = (e) => {
        worker.terminate();
        reject(Error(e.message));
      };
      worker.postMessage({
        pixels: pixels.data,
        width: c.width,
        height: c.height,
        colors: Math.max(
          2,
          Math.min(64, Number($("#trace-colors").value) || 16),
        ),
        smoothing: Math.max(0.5, Number($("#trace-smoothing").value) || 3),
        detail: Math.max(0, Number($("#trace-detail").value) || 0),
        mode: $("#trace-mode").value,
        threshold: Number($("#threshold").value),
      });
    });
  };
  const run = async (create) => {
    const button = $("#trace");
    button.disabled = true;
    $("#trace-preview-button").disabled = true;
    $("#trace-count").textContent = "Tracing…";
    try {
      const layers = await calculate();
      if (!layers.length)
        throw Error(
          "No contours found. Lower detail removal or adjust the mode.",
        );
      const traced = layers.map((layer, i) =>
        node("vector", source.x + source.w + 30, source.y, source.w, source.h, {
          name: source.name + " — color " + (i + 1),
          vertices: layer.vertices,
          closed: true,
          fill: layer.color,
          opacity: layer.opacity,
          strokeWidth: 0,
          rotation: source.rotation,
          flipX: source.flipX,
          flipY: source.flipY,
        }),
      );
      $("#trace-count").textContent =
        layers.length +
        " color layers · " +
        layers.reduce((n, l) => n + l.vertices.length, 0) +
        " anchors";
      $("#trace-preview").innerHTML = exportSVG(traced);
      $("#trace-preview svg").style.cssText = "width:100%;max-height:200px";
      if (create) {
        change(() => {
          if (traced.length > 1) {
            const group = node(
              "group",
              source.x + source.w + 30,
              source.y,
              source.w,
              source.h,
              { name: source.name + " — vector" },
            );
            traced.forEach((n) => (n.parent = group.id));
            target.nodes.push(group, ...traced);
            selected = new Set([group.id]);
          } else {
            target.nodes.push(...traced);
            selected = new Set([traced[0].id]);
          }
        });
        $("#dialog").close();
        toast(
          "Editable vectors created. Double-click a colored region to edit its points.",
        );
      }
    } catch (e) {
      $("#trace-count").textContent = e.message;
    } finally {
      button.disabled = false;
      $("#trace-preview-button").disabled = false;
    }
  };
  $("#trace").onclick = () => run(true);
  $("#trace-preview-button").onclick = () => run(false);
  const original = document.createElement("img");
  original.src = source.src;
  original.alt = "Original image";
  original.className = "action-original";
  $("#trace-preview").before(original);
  let previewTimer,
    previewRunning = false,
    previewAgain = false;
  const preview = async () => {
    if (previewRunning) {
      previewAgain = true;
      return;
    }
    previewRunning = true;
    await run(false);
    previewRunning = false;
    if (previewAgain && $("#dialog").open) {
      previewAgain = false;
      preview();
    }
  };
  for (const id of [
    "trace-mode",
    "trace-colors",
    "trace-smoothing",
    "trace-detail",
    "trace-resolution",
    "threshold",
  ])
    $("#" + id).addEventListener("input", () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(preview, 250);
    });
  preview();
  $("#dialog").addEventListener("close", () => clearTimeout(previewTimer), {
    once: true,
  });
  $("#dialog").addEventListener("close", () => worker?.terminate(), {
    once: true,
  });
}
async function backgroundDialog() {
  const source = picked()[0];
  if (!source || source.type !== "image") return;
  try {
    const c = await imageCanvas(source),
      ctx = c.getContext("2d"),
      pixels = ctx.getImageData(0, 0, c.width, c.height),
      sample =
        "#" +
        [...pixels.data.slice(0, 3)]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
    dialog(
      '<h2>Remove background</h2><p>Automatically detects the dominant border background and protects strong edges. For similar foreground/background colors, paint over the object to protect it. The original is preserved.</p><label>Tolerance<input id="background-tolerance" type="range" min="0" max="120" value="30"></label><label class="keep-toggle"><input id="keep-object" type="checkbox"> Keep object brush — paint on the preview</label><button id="clear-keep">Clear protection</button><button id="remove-background" class="primary">Create transparent image</button>',
    );
    const previewBox = document.createElement("div");
    previewBox.className = "image-comparison";
    previewBox.innerHTML =
      '<figure><figcaption>Original</figcaption><img alt="Original image"></figure><figure><figcaption>Preview</figcaption><canvas></canvas></figure>';
    $("#remove-background").before(previewBox);
    previewBox.querySelector("img").src = source.src;
    const previewCanvas = previewBox.querySelector("canvas");
    previewCanvas.width = c.width;
    previewCanvas.height = c.height;
    const keep = new Uint8Array(c.width * c.height);
    const calculateBackground = () =>
      removeAutoBackground(
        pixels.data,
        c.width,
        c.height,
        Number($("#background-tolerance").value),
        keep,
      );
    const updatePreview = () => {
      const result = calculateBackground();
      previewCanvas
        .getContext("2d")
        .putImageData(
          new ImageData(new Uint8ClampedArray(result.data), c.width, c.height),
          0,
          0,
        );
    };
    let painting = false;
    const paintKeep = (e) => {
      if (!$("#keep-object").checked) return;
      const r = previewCanvas.getBoundingClientRect(),
        scale = Math.min(r.width / c.width, r.height / c.height),
        ox = (r.width - c.width * scale) / 2,
        oy = (r.height - c.height * scale) / 2,
        x = (e.clientX - r.left - ox) / scale,
        y = (e.clientY - r.top - oy) / scale,
        radius = 14 / scale;
      for (
        let yy = Math.max(0, Math.floor(y - radius));
        yy < Math.min(c.height, y + radius);
        yy++
      )
        for (
          let xx = Math.max(0, Math.floor(x - radius));
          xx < Math.min(c.width, x + radius);
          xx++
        )
          if ((xx - x) ** 2 + (yy - y) ** 2 <= radius ** 2)
            keep[yy * c.width + xx] = 1;
      updatePreview();
    };
    previewCanvas.onpointerdown = (e) => {
      if (!$("#keep-object").checked) return;
      painting = true;
      previewCanvas.setPointerCapture(e.pointerId);
      paintKeep(e);
    };
    previewCanvas.onpointermove = (e) => {
      if (painting) paintKeep(e);
    };
    previewCanvas.onpointerup = () => (painting = false);
    previewCanvas.onpointercancel = () => (painting = false);
    $("#clear-keep").onclick = () => {
      keep.fill(0);
      updatePreview();
    };
    $("#background-tolerance").oninput = updatePreview;
    updatePreview();
    $("#remove-background").onclick = () => {
      const result = calculateBackground();
      if (!result.removed) {
        toast("No background removed. Adjust tolerance or clear protection.");
        return;
      }
      pixels.data.set(result.data);
      ctx.putImageData(pixels, 0, 0);
      change(() => {
        const n = node(
          "image",
          source.x + source.w + 30,
          source.y,
          source.w,
          source.h,
          {
            name: source.name.replace(/\.[^.]+$/, "") + " — transparent.png",
            mime: "image/png",
            src: c.toDataURL("image/png"),
            strokeWidth: 0,
            rotation: source.rotation,
            flipX: source.flipX,
            flipY: source.flipY,
          },
        );
        nodes().push(n);
        selected = new Set([n.id]);
      });
      $("#dialog").close();
      toast("Transparent image created; original retained.");
    };
  } catch (e) {
    toast(e.message || "Could not remove the background.");
  }
}
function openHelp() {
  dialog(
    "<h2>Welcome to Magic.</h2><p>A local, open-source space for collecting files and making visual work.</p><ul><li>Projects live in the top tabs. Each project contains pages, frames, groups and layers.</li><li>Ctrl-click toggles layers. Shift-click in the layer tree selects a range within its common container. Click empty canvas to deselect.</li><li>Hold Space and drag to pan; use the wheel to zoom.</li><li>Pen previews your path as you draw. Enter finishes it. Double-click shapes and paths to edit anchors and curve handles.</li><li>Double-click a layer name or frame title to rename it. Right-click also offers Rename.</li><li>Fill and stroke rows can be added, hidden, reordered, and edited by hex color and opacity.</li><li>Export SVG/PNG at the bottom right. Actions is a searchable tool library that remembers recent and frequent tools.</li><li>Right-click empty canvas to customize its color. Ctrl S saves a portable .magic file including assets.</li></ul><p>Desktop and browser storage are separate. Transfer work using .magic files. Office and 3D files remain downloadable attachments; comments are project-local.</p>",
  );
}
document.addEventListener("keydown", (e) => {
  if (
    e.target.closest("input,textarea,select,[contenteditable]") ||
    $("#dialog").open
  )
    return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.code === "Space") {
    space = true;
    e.preventDefault();
    renderCanvas();
    return;
  }
  if (mod) {
    const key = e.key.toLowerCase();
    if (["z", "y", "s", "a", "c", "v", "d", "g", "o"].includes(key))
      e.preventDefault();
    if (key === "z")
      restore(e.shiftKey ? future : history, e.shiftKey ? history : future);
    if (key === "y") restore(future, history);
    if (key === "s") saveProject();
    if (key === "a") {
      selected = new Set(
        nodes()
          .filter((n) => !locked(n) && !hidden(n))
          .map((n) => n.id),
      );
      render();
    }
    if (key === "c") command("copy");
    if (key === "v") command(e.shiftKey ? "replace" : "paste");
    if (key === "d") command("duplicate");
    if (key === "g") command(e.shiftKey ? "ungroup" : "group");
    if (key === "o") $("#project-input").click();
    return;
  }
  if (e.key === "Escape" && editingId) {
    editingId = null;
    vertexIndex = null;
    tool = "move";
    render();
    save();
    return;
  }
  if (e.key === "F2") {
    e.preventDefault();
    command("rename");
    return;
  }
  if (e.key === "Escape") {
    if (tool === "pen" && $("#draw").value === "pencil") finishGesture();
    if (enteredContainer)
      enteredContainer =
        nodes().find((n) => n.id === enteredContainer)?.parent || null;
    penPoints = [];
    penHover = null;
    selected.clear();
    $("#context-menu").hidden = true;
    setTool("move");
  }
  if (e.key === "Enter") {
    if (tool === "pen") e.preventDefault();
    if (tool === "pen" && $("#draw").value === "pencil") {
      finishGesture();
      setTool("move");
    } else finishPen();
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    editingId &&
    vertexIndex !== null
  ) {
    e.preventDefault();
    const n = picked()[0];
    if (n.vertices.length > (n.closed ? 3 : 2))
      change(() => {
        removeVertex(n, vertexIndex);
        vertexIndex = null;
      });
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    command("delete");
  }
  if (e.key === "[") command("back");
  if (e.key === "]") command("front");
  if (e.key.startsWith("Arrow") && selected.size) {
    e.preventDefault();
    const distance = e.shiftKey ? 10 : 1;
    change(() => {
      const ids = descendants(nodes(), selected);
      nodes()
        .filter((n) => ids.has(n.id) && !locked(n))
        .forEach((n) => {
          n.x +=
            e.key === "ArrowRight"
              ? distance
              : e.key === "ArrowLeft"
                ? -distance
                : 0;
          n.y +=
            e.key === "ArrowDown"
              ? distance
              : e.key === "ArrowUp"
                ? -distance
                : 0;
        });
    });
  }
  const keys = {
    v: "move",
    f: "frame",
    r: "shape",
    p: "pen",
    t: "text",
    c: "comment",
  };
  if (keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
});
document.addEventListener("keyup", (e) => {
  if (e.target.closest("input,textarea,select,[contenteditable]")) return;
  if (e.code === "Space") {
    space = false;
    renderCanvas();
  }
});
window.addEventListener("blur", () => {
  space = false;
  finishGesture();
});
window.addEventListener("beforeunload", () => {
  if (db) {
    const tx = db.transaction("workspace", "readwrite");
    tx.objectStore("workspace").put(clone({ projects, activeId }), "state");
  }
});

function selectLayer(id, e, fromTree = false) {
  const target = nodes().find((n) => n.id === id);
  if (target) id = canvasTarget(target).id;
  if (e.shiftKey && fromTree && selectionAnchor)
    selected = new Set(
      [...rangeSelection(nodes(), selectionAnchor, id)].map(
        (id) => canvasTarget(nodes().find((n) => n.id === id)).id,
      ),
    );
  else if (e.ctrlKey || e.metaKey || e.shiftKey) {
    selected.has(id) ? selected.delete(id) : selected.add(id);
    selectionAnchor = id;
  } else {
    selected = new Set([id]);
    selectionAnchor = id;
  }
  if (editingId !== id) editingId = null;
}
function renameLayer(n, element) {
  if (!n || locked(n)) return;
  if (element.querySelector("input")) return;
  const input = document.createElement("input");
  input.className = "inline-name";
  input.value = n.name;
  if (element.classList.contains("frame-label")) {
    input.style.width =
      Math.max(100, Math.min(400, n.name.length * 6.5 + 14)) + "px";
    input.oninput = () =>
      (input.style.width =
        Math.max(100, Math.min(400, input.value.length * 6.5 + 14)) + "px");
  }
  input.setAttribute("aria-label", "Rename layer");
  element.replaceChildren(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (commit && name && name !== n.name) change(() => (n.name = name));
    else render();
  };
  input.addEventListener("pointerdown", (e) => e.stopPropagation());
  input.addEventListener("click", (e) => e.stopPropagation());
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  };
  input.onblur = () => finish(true);
}
function beginVector(n) {
  if (!n || !editableTypes.has(n.type) || locked(n)) return;
  if (n.type !== "vector") {
    checkpoint();
    vectorize(n);
    save();
  }
  editingId = n.id;
  edgeHover = null;
  vertexIndex = null;
  selected = new Set([n.id]);
  tool = "pen";
  penPoints = [];
  render();
}
function vectorOverlay(n) {
  const scale = 1 / view().zoom;
  return `<svg class="vector-overlay" viewBox="0 0 ${n.w} ${n.h}" style="overflow:visible">${n.vertices.map((p, i) => ["in", "out"].map((key) => (p[key] ? `<line x1="${p.x * n.w}" y1="${p.y * n.h}" x2="${p[key].x * n.w}" y2="${p[key].y * n.h}" stroke="#12cafd" stroke-width="${scale}"/><circle data-vertex="${i}" data-handle="${key}" cx="${p[key].x * n.w}" cy="${p[key].y * n.h}" r="${4 * scale}" fill="#fff" stroke="#12cafd" stroke-width="${scale}"/>` : "")).join("") + `<rect data-vertex="${i}" x="${p.x * n.w - 4 * scale}" y="${p.y * n.h - 4 * scale}" width="${8 * scale}" height="${8 * scale}" fill="${vertexIndex === i ? "#12cafd" : "#fff"}" stroke="#009cbd" stroke-width="${1.5 * scale}"/>`).join("")}${hoverMarker(n, scale)}</svg>`;
}
function hoverMarker(n, scale) {
  if (!edgeHover || edgeHover.d >= 12) return "";
  return (
    '<circle class="edge-hover" cx="' +
    edgeHover.q.x * n.w +
    '" cy="' +
    edgeHover.q.y * n.h +
    '" r="' +
    5 * scale +
    '" fill="#173b49" stroke="#12cafd" stroke-width="' +
    1.5 * scale +
    '"/>'
  );
}
function drawDraft() {
  $("#pen-preview")?.remove();
  if (!penPoints.length) return;
  const v = view(),
    points = [...penPoints, ...(penHover ? [penHover] : [])];
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.id = "pen-preview";
  el.style.cssText =
    "position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none";
  el.innerHTML = `<path d="${pathData({ vertices: points, w: 1, h: 1, closed: false })}" fill="none" stroke="#12cafd" stroke-width="${2 / v.zoom}"/>${penPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${3 / v.zoom}" fill="white" stroke="#009cbd" stroke-width="${1 / v.zoom}"/>`).join("")}`;
  for (const p of penPoints)
    for (const k of ["in", "out"])
      if (p[k])
        el.innerHTML += `<line x1="${p.x}" y1="${p.y}" x2="${p[k].x}" y2="${p[k].y}" stroke="#12cafd" stroke-width="${1 / v.zoom}"/><circle cx="${p[k].x}" cy="${p[k].y}" r="${3 / v.zoom}" fill="white"/>`;
  if (penHover?.snapped)
    el.innerHTML += `<circle cx="${penHover.x}" cy="${penHover.y}" r="${8 / v.zoom}" fill="none" stroke="#12cafd" stroke-width="${1 / v.zoom}"/>`;
  $("#world").append(el);
}
function snapPen(p) {
  let best = { ...p },
    d = 8 / view().zoom;
  const offer = (q, close = false) => {
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (dist < d) {
      d = dist;
      best = { ...q, snapped: true, close };
    }
  };
  penPoints.forEach((q, i) => offer(q, i === 0));
  for (const n of nodes()) {
    if (hidden(n) || locked(n) || !editableTypes.has(n.type)) continue;
    const copy = clone(n);
    vectorize(copy);
    for (const v of copy.vertices) {
      const a = ((copy.rotation || 0) * Math.PI) / 180,
        dx = (v.x - 0.5) * copy.w * (copy.flipX ? -1 : 1),
        dy = (v.y - 0.5) * copy.h * (copy.flipY ? -1 : 1);
      offer({
        x: copy.x + copy.w / 2 + dx * Math.cos(a) - dy * Math.sin(a),
        y: copy.y + copy.h / 2 + dx * Math.sin(a) + dy * Math.cos(a),
      });
    }
  }
  return best;
}
function handleVectorDown(e, p) {
  const n = nodes().find((n) => n.id === editingId);
  if (!n) return false;
  const hit = e.target.closest("[data-vertex]"),
    local = localPoint(n, p);
  if (hit) {
    vertexIndex = Number(hit.dataset.vertex);
    const key = hit.dataset.handle;
    if (e.altKey && !key) {
      if (n.vertices.length > (n.closed ? 3 : 2))
        change(() => removeVertex(n, vertexIndex));
      return true;
    }
    checkpoint();
    gesture = {
      kind: "vertex",
      id: n.id,
      index: vertexIndex,
      handle: key,
      start: clone(n.vertices[vertexIndex]),
      p: local,
    };
    renderCanvas();
    renderInspector();
    $("#viewport").setPointerCapture(e.pointerId);
    return true;
  }
  const closest = nearestEdge(n, local, view().zoom);
  if (closest && closest.d < 12) {
    edgeHover = null;
    if (e.ctrlKey || e.metaKey) {
      checkpoint();
      gesture = {
        kind: "bend",
        id: n.id,
        index: closest.i,
        t: closest.t,
        p: local,
        original: {
          a: clone(n.vertices[closest.i]),
          b: clone(n.vertices[nextVertexIndex(n, closest.i)]),
        },
      };
      $("#viewport").setPointerCapture(e.pointerId);
    } else change(() => (vertexIndex = splitEdge(n, closest.i, closest.t)));
    return true;
  }
  editingId = null;
  vertexIndex = null;
  selected.clear();
  tool = "move";
  render();
  return true;
}
function paintSection(n, kind) {
  const list = paints(n, kind);
  return `<div class="property-section paint-section"><div class="section-title">${kind === "fills" ? "Fill" : "Stroke"}<button data-paint-add="${kind}" title="Add ${kind === "fills" ? "fill" : "stroke"}">＋</button></div>${list.map((p, i) => `<div class="paint-entry ${p.visible === false ? "disabled-paint" : ""}"><div class="paint-row"><input aria-label="${kind} ${i + 1} color" type="color" data-paint="${kind}" data-index="${i}" data-key="color" value="${esc(p.color)}"><input aria-label="${kind} ${i + 1} hex" class="paint-hex" data-paint="${kind}" data-index="${i}" data-key="hex" value="${esc(p.color.replace("#", "").toUpperCase())}" maxlength="7"><label class="paint-opacity"><input aria-label="${kind} ${i + 1} opacity" type="number" min="0" max="100" data-paint="${kind}" data-index="${i}" data-key="opacity" value="${Math.round(p.opacity * 100)}">%</label><button data-paint-toggle="${kind}" data-index="${i}" title="Toggle paint">${p.visible === false ? "◌" : "◉"}</button><button data-paint-remove="${kind}" data-index="${i}" title="Remove paint">−</button></div>${kind === "strokes" ? `<div class="stroke-options"><label>Position<select data-paint="${kind}" data-index="${i}" data-key="position">${["inside", "center", "outside"].map((v) => `<option ${p.position === v ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>Weight<input type="number" min="0" max="1000" data-paint="${kind}" data-index="${i}" data-key="width" value="${p.width}"></label></div>` : ""}<div class="paint-order"><button data-paint-up="${kind}" data-index="${i}" ${i === 0 ? "disabled" : ""}>↑ Move above</button></div></div>`).join("") || '<small class="muted">No paint. Use + to add one.</small>'}</div>`;
}
function updatePaint(e) {
  const el = e.target,
    kind = el.dataset.paint;
  if (!kind) return;
  let key = el.dataset.key,
    value = el.value;
  if (key === "hex") {
    value = "#" + value.replace(/^#/, "");
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      if (e.type === "change") {
        toast("Use a six-digit HTML hex color.");
        paintSession = null;
        renderInspector();
      }
      return;
    }
    key = "color";
  }
  if ((key === "opacity" || key === "width") && value === "") return;
  if (key === "opacity")
    value = Math.max(0, Math.min(100, Number(value))) / 100;
  if (key === "width") value = Math.max(0, Math.min(1000, Number(value)));
  if (typeof value === "number" && !Number.isFinite(value)) return;
  if (paintSession !== el) {
    checkpoint();
    paintSession = el;
  }
  for (const n of picked().filter((n) => !locked(n))) {
    n[kind] = clone(paints(n, kind));
    if (n[kind][el.dataset.index]) n[kind][el.dataset.index][key] = value;
  }
  // Keep the picker and focused input alive while repainting the canvas.
  const row = el.closest(".paint-row");
  if (key === "color" && row) {
    for (const field of row.querySelectorAll(
      '[data-key="color"],[data-key="hex"]',
    ))
      if (field !== el)
        field.value =
          field.dataset.key === "hex" ? value.slice(1).toUpperCase() : value;
  }
  renderCanvas();
  save();
  $("#undo").disabled = !history.length;
  $("#redo").disabled = !future.length;
  if (e.type === "change") paintSession = null;
}
function renderExport() {
  const asset = picked().length === 1 ? picked()[0] : null;
  if (asset?.src && ["audio", "video"].includes(asset.type)) {
    const audioFormats =
      asset.type === "audio"
        ? ["MP3", "WAV", "FLAC", "OGG", "M4A"]
        : ["MP3", "WAV"];
    const videoFormats =
      asset.type === "video" ? ["MP4", "MOV", "WEBM", "MKV"] : [];
    const option = (f) => '<option value="' + f + '">' + f + "</option>";
    $("#export-panel").innerHTML =
      '<div class="section-title">Export ' +
      asset.type +
      '</div><div class="export-controls"><select id="export-format" aria-label="Export format"><option value="Original">Original file</option>' +
      (videoFormats.length
        ? '<optgroup label="Video + audio">' +
          videoFormats.map(option).join("") +
          "</optgroup>"
        : "") +
      '<optgroup label="Audio only">' +
      audioFormats.map(option).join("") +
      '</optgroup></select><button id="export-design" class="primary"></button></div><p id="media-export-description"></p>';
    const select = $("#export-format");
    select.value = mediaExportChoices.get(asset.id) || "Original";
    const update = () => {
      const format = select.value;
      mediaExportChoices.set(asset.id, format);
      $("#export-design").textContent =
        format === "Original" ? "Export original ↗" : "Export " + format + " ↗";
      $("#media-export-description").textContent =
        format === "Original"
          ? "Preserves the original file."
          : videoFormats.includes(format)
            ? "Video with sound, when present."
            : asset.type === "video"
              ? "Audio only — the video picture will be removed."
              : "Audio conversion.";
    };
    select.onchange = update;
    update();
    return;
  }
  if (
    asset?.src &&
    /\.(obj|stl|fbx|gltf|glb|ply|3mf|dae|3ds|blend|off|x)$/i.test(asset.name)
  ) {
    const convertible = true;
    $("#export-panel").innerHTML =
      '<div class="section-title">Export 3D</div><div class="export-controls"><select id="export-format" aria-label="Export format"><option>Original</option>' +
      (convertible
        ? "<option>OBJ</option><option>STL</option><option>PLY</option><option>FBX</option><option>GLB</option>"
        : "") +
      '</select><button id="export-design" class="primary">Export model ↗</button></div><p class="mesh-note">' +
      (convertible
        ? "OBJ/STL/PLY/FBX export mesh geometry. GLB can retain supported materials and scene data. Include companion assets on this page."
        : "Original file preserved. Conversion for this format is not yet supported.") +
      "</p>";
    return;
  }
  const count = selected.size;
  $("#export-panel").innerHTML =
    `<div class="section-title">Export <span class="badge">${count ? "SELECTION" : "PAGE"}</span></div><div class="export-controls"><select id="export-format" aria-label="Export format"><option>SVG</option><option>PNG</option><option>PDF</option><option>JPEG</option></select><button id="export-design" class="primary">Export ${count ? "selection" : "page"} ↗</button></div>`;
}
async function exportDesign() {
  const format = $("#export-format").value;
  if (format === "Original") return openAssetDownload(picked()[0]);
  if (["audio", "video"].includes(picked()[0]?.type))
    return exportMedia(picked()[0], format);
  if (["OBJ", "STL", "PLY", "FBX", "GLB"].includes(format)) {
    const n = picked()[0],
      button = $("#export-design");
    button.disabled = true;
    button.textContent = "Converting…";
    const worker = new Worker(new URL("./model-worker.js", import.meta.url));
    try {
      const files = [n, ...nodes().filter((a) => a.id !== n.id && a.src)].map(
        (a) => ({
          name: a.name,
          bytes: Uint8Array.from(atob(a.src.split(",")[1]), (c) =>
            c.charCodeAt(0),
          ),
        }),
      );
      const result = await new Promise((resolve, reject) => {
        worker.onmessage = (e) =>
          e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
        worker.onerror = (e) => reject(Error(e.message));
        worker.postMessage({ files, format });
      });
      download(
        n.name.replace(/\.[^.]+$/, "") + "." + format.toLowerCase(),
        result.bytes || result.text,
        "application/octet-stream",
      );
    } catch (e) {
      toast(e.message);
    } finally {
      worker.terminate();
      renderExport();
    }
    return;
  }
  if (format !== "SVG") return exportPNG(false, format);
  const list = exportNodes();
  if (
    list.some((n) =>
      ["pdf", "video", "audio", "file", "comment"].includes(n.type),
    )
  )
    toast("Attachments and comments are omitted from design exports.");
  download(pg().name + ".svg", exportSVG(list), "image/svg+xml");
}
const actionTools = [
  {
    id: "trace",
    name: "Image → vector",
    description: "Trace color artwork or silhouettes into editable curves.",
    icon: "◈",
    run: traceDialog,
  },
  {
    id: "background",
    name: "Remove background",
    description:
      "Remove a flat, edge-connected background by color and tolerance.",
    icon: "◐",
    run: backgroundDialog,
  },
];
function rememberAction(id) {
  const usage = preferences.usage[id] || { count: 0, last: 0 };
  preferences.usage[id] = { count: usage.count + 1, last: Date.now() };
  savePreferences();
}
function savePreferences() {
  try {
    localStorage.setItem("magic-preferences", JSON.stringify(preferences));
  } catch {
    toast("Preferences could not be saved on this device.");
  }
}
function openActions() {
  dialog(
    '<h2>Actions library</h2><p>Find a tool. Your recent and most-used tools stay close.</p><input id="action-search" type="search" placeholder="Search tools…" aria-label="Search action library"><div id="action-results"></div>',
  );
  const draw = () => {
    const q = $("#action-search").value.toLowerCase(),
      matches = actionTools.filter((a) =>
        (a.name + " " + a.description).toLowerCase().includes(q),
      ),
      used = actionTools.filter((a) => preferences.usage[a.id]);
    const section = (title, list) =>
      list.length
        ? `<h3 class="library-heading">${title}</h3>${list.map((a) => `<button class="action-card" data-run-action="${a.id}"><span>${a.icon}</span><div>${a.name}<small>${a.description}</small></div></button>`).join("")}`
        : "";
    $("#action-results").innerHTML =
      (q
        ? ""
        : section(
            "Recent",
            used
              .slice()
              .sort(
                (a, b) =>
                  preferences.usage[b.id].last - preferences.usage[a.id].last,
              )
              .slice(0, 3),
          ) +
          section(
            "Most used",
            used
              .slice()
              .sort(
                (a, b) =>
                  preferences.usage[b.id].count - preferences.usage[a.id].count,
              )
              .slice(0, 3),
          )) +
      section(q ? "Search results" : "All tools", matches) +
      (matches.length ? "" : "<p>No tools match your search.</p>");
  };
  $("#action-search").oninput = draw;
  $("#action-results").onclick = (e) => {
    const id = e.target.closest("[data-run-action]")?.dataset.runAction;
    if (!id) return;
    const a = actionTools.find((a) => a.id === id);
    if (!picked().length) {
      toast("Select a layer first.");
      return;
    }
    if (
      ["trace", "background"].includes(a.id) &&
      picked()[0].type !== "image"
    ) {
      toast("Select an image for this transformation.");
      return;
    }
    if (a.id === "vector" && !editableTypes.has(picked()[0].type)) {
      toast("Select a shape or drawn path.");
      return;
    }
    rememberAction(id);
    a.run();
  };
  draw();
  $("#action-search").focus();
}
const shapeOptions = [
  ["rectangle", "□", "Rectangle"],
  ["triangle", "△", "Triangle"],
  ["ellipse", "○", "Ellipse"],
  ["line", "╱", "Line"],
  ["arrow", "↗", "Arrow"],
  ["polygon", "⬡", "Polygon"],
  ["star", "☆", "Star"],
];
const drawOptions = [
  ["pen", penIcon, "Pen"],
  ["pencil", pencilIcon, "Pencil"],
];
function updateToolIcons() {
  const s = shapeOptions.find((o) => o[0] === $("#shape").value),
    d = drawOptions.find((o) => o[0] === $("#draw").value);
  $('[data-tool="shape"] span').textContent = s[1];
  $('[data-tool="shape"]').title = `${s[2]} · R`;
  $('[data-tool="pen"] span').innerHTML = d[1];
  $('[data-tool="pen"]').title = `${d[2]} · P`;
}
function toolMenu(kind, button) {
  const options = kind === "shape" ? shapeOptions : drawOptions;
  $("#tool-menu").innerHTML = options
    .map(
      ([id, icon, label]) =>
        `<button data-tool-option="${id}" data-kind="${kind}"><span>${icon}</span>${label}<span>${$("#" + kind).value === id ? "✓" : ""}</span></button>`,
    )
    .join("");
  const rect = button.getBoundingClientRect();
  $("#tool-menu").hidden = false;
  $("#tool-menu").style.left = rect.left + "px";
  $("#tool-menu").style.bottom = innerHeight - rect.top + 10 + "px";
}
function customizeCanvas() {
  dialog(
    `<h2>Customize canvas</h2><p>This color belongs to the current page and travels with your project.</p><label>Canvas color<div class="canvas-color-row"><input type="color" id="canvas-color" value="${pg().background || "#202326"}"><input id="canvas-hex" aria-label="Canvas HTML color" value="${pg().background || "#202326"}"></div></label><button id="apply-canvas" class="primary">Apply color</button>`,
  );
  $("#canvas-color").oninput = (e) => ($("#canvas-hex").value = e.target.value);
  $("#apply-canvas").onclick = () => {
    const value = $("#canvas-hex").value;
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      toast("Enter a six-digit hex color beginning with #.");
      return;
    }
    change(() => (pg().background = value));
    $("#dialog").close();
  };
}
$("#inspector").addEventListener("input", updatePaint);
$("#inspector").addEventListener("change", updatePaint);
$("#inspector").addEventListener("focusout", (e) => {
  if (e.target === paintSession) paintSession = null;
});
$("#layers").addEventListener("dblclick", (e) => {
  if (e.target.closest("button,input")) return;
  const row = e.target.closest("[data-node]");
  if (row)
    renameLayer(
      nodes().find((n) => n.id === row.dataset.node),
      row.querySelector(".name"),
    );
});
$("#layers").addEventListener("contextmenu", (e) => {
  const row = e.target.closest("[data-node]");
  if (row) {
    if (!selected.has(row.dataset.node)) selected = new Set([row.dataset.node]);
    render();
    menu(e, true);
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.paintAdd || d.paintRemove || d.paintToggle || d.paintUp) {
    const kind = d.paintAdd || d.paintRemove || d.paintToggle || d.paintUp;
    change(() => {
      for (const n of picked().filter((n) => !locked(n))) {
        n[kind] = clone(paints(n, kind));
        const i = Number(d.index);
        if (d.paintAdd)
          n[kind].unshift({
            color: "#12cafd",
            opacity: 1,
            visible: true,
            ...(kind === "strokes" ? { width: 1, position: "center" } : {}),
          });
        if (d.paintRemove) n[kind].splice(i, 1);
        if (d.paintToggle && n[kind][i])
          n[kind][i].visible = n[kind][i].visible === false;
        if (d.paintUp && i > 0)
          [n[kind][i - 1], n[kind][i]] = [n[kind][i], n[kind][i - 1]];
      }
    });
  }
  if (d.toolMenu) toolMenu(d.toolMenu, b);
  else if (d.toolOption) {
    $("#" + d.kind).value = d.toolOption;
    preferences[d.kind] = d.toolOption;
    savePreferences();
    $("#tool-menu").hidden = true;
    setTool(d.kind === "draw" ? "pen" : "shape");
    updateToolIcons();
  } else if (!e.target.closest("#tool-menu")) $("#tool-menu").hidden = true;
  if (b.id === "export-design") exportDesign();
  if (b.id === "customize-canvas") customizeCanvas();
  if (b.id === "context-actions") {
    openActions();
    $("#context-menu").hidden = true;
  }
  if (b.id === "customize-canvas") $("#context-menu").hidden = true;
  if (b.id === "finish-vector") {
    editingId = null;
    vertexIndex = null;
    tool = "move";
    render();
    save();
  }
  if (b.id === "toggle-closed")
    change(() => {
      const n = picked()[0];
      n.closed = !n.closed;
    });
  if (b.id === "curve-vertex" && vertexIndex !== null)
    change(() => {
      const p = picked()[0].vertices[vertexIndex];
      if (p.in || p.out) {
        delete p.in;
        delete p.out;
      } else {
        p.in = { x: p.x - 0.12, y: p.y };
        p.out = { x: p.x + 0.12, y: p.y };
      }
    });
});

$("#shape").value = preferences.shape || "rectangle";
$("#draw").value = preferences.draw || "pen";
$('[data-tool="comment"] span').innerHTML = commentIcon;
$$(".tool-chevron").forEach((b) => (b.innerHTML = chevronIcon));
render();
save();
installColorPicker();

function visualBounds(n) {
  const a = ((n.rotation || 0) * Math.PI) / 180,
    w = Math.abs(n.w * Math.cos(a)) + Math.abs(n.h * Math.sin(a)),
    h = Math.abs(n.w * Math.sin(a)) + Math.abs(n.h * Math.cos(a));
  return { x: n.x + (n.w - w) / 2, y: n.y + (n.h - h) / 2, w, h };
}
function intersects(a, b) {
  return (
    a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
  );
}
const divider = document.createElement("div");
divider.id = "sidebar-divider";
divider.setAttribute("role", "separator");
divider.title = "Drag to resize sidebar";
document.querySelector(".left").append(divider);
if (preferences.sidebarWidth)
  document.documentElement.style.setProperty(
    "--left-panel-width",
    preferences.sidebarWidth + "px",
  );
divider.onpointerdown = (e) => {
  divider.setPointerCapture(e.pointerId);
};
divider.onpointermove = (e) => {
  if (!divider.hasPointerCapture(e.pointerId)) return;
  preferences.sidebarWidth = Math.max(
    160,
    Math.min(innerWidth - 550, e.clientX),
  );
  document.documentElement.style.setProperty(
    "--left-panel-width",
    preferences.sidebarWidth + "px",
  );
};
divider.onpointerup = (e) => {
  divider.releasePointerCapture(e.pointerId);
  savePreferences();
};

// Blank layer-panel space starts a marquee; dragging a row reorders/reparents it.
let treeDrag = null,
  suppressTreeClick = false;
$("#layers").addEventListener("pointerdown", (e) => {
  if (e.button || e.target.closest("button,input")) return;
  const row = e.target.closest("[data-node]");
  treeDrag = {
    id: row
      ? canvasTarget(nodes().find((n) => n.id === row.dataset.node)).id
      : null,
    x: e.clientX,
    y: e.clientY,
    base: e.ctrlKey ? new Set(selected) : new Set(),
    moved: false,
  };
});
window.addEventListener("pointermove", (e) => {
  if (!treeDrag) return;
  const g = treeDrag;
  if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5 && !g.moved) return;
  g.moved = true;
  if (g.id) {
    document.body.style.cursor = "grabbing";
    return;
  }
  const box = {
    x: Math.min(g.x, e.clientX),
    y: Math.min(g.y, e.clientY),
    w: Math.abs(e.clientX - g.x),
    h: Math.abs(e.clientY - g.y),
  };
  selected = new Set(g.base);
  for (const row of $$("#layers [data-node]")) {
    const r = row.getBoundingClientRect();
    if (intersects(box, { x: r.x, y: r.y, w: r.width, h: r.height }))
      selected.add(row.dataset.node);
  }
  renderCanvas();
  for (const row of $$("#layers [data-node]"))
    row.classList.toggle("selected", selected.has(row.dataset.node));
  let m = $("#tree-marquee");
  if (!m) {
    m = document.createElement("div");
    m.id = "tree-marquee";
    document.body.append(m);
  }
  Object.assign(m.style, {
    position: "fixed",
    pointerEvents: "none",
    border: "1px solid #12cafd",
    background: "#12cafd22",
    zIndex: 1000,
    left: box.x + "px",
    top: box.y + "px",
    width: box.w + "px",
    height: box.h + "px",
  });
});
window.addEventListener("pointerup", (e) => {
  const g = treeDrag;
  treeDrag = null;
  document.body.style.cursor = "";
  $("#tree-marquee")?.remove();
  if (!g?.moved) return;
  suppressTreeClick = true;
  if (g.id) {
    const dest = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-node]")?.dataset.node;
    const n = nodes().find((n) => n.id === g.id),
      target = nodes().find((n) => n.id === dest);
    if (n && (!target || !descendants(nodes(), [n.id]).has(target.id)))
      change(() => {
        n.parent = target
          ? ["frame", "group"].includes(target.type)
            ? target.id
            : target.parent
          : null;
        const list = nodes(),
          i = list.indexOf(n);
        list.splice(i, 1);
        list.splice(target ? list.indexOf(target) + 1 : list.length, 0, n);
        syncContainers();
      });
  }
  render();
  setTimeout(() => (suppressTreeClick = false), 0);
});
$("#layers").addEventListener(
  "click",
  (e) => {
    if (suppressTreeClick) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true,
);

async function checkUpdates() {
  dialog('<h2>Updates</h2><p id="update-status" role="status">Check for a newer version of Magic.</p><button id="check-release" class="primary">Check for Updates</button>');
  const button = $('#check-release'), status = $('#update-status');
  button.onclick = async () => {
    if (!window.magicDesktop) { status.textContent = 'Updates are available in the Magic desktop app.'; return; }
    document.querySelector('#download-release')?.remove();
    button.disabled = true; status.textContent = 'Checking for updates…';
    try {
      const result = await window.magicDesktop.checkUpdates();
      status.textContent = result.status === 'current' ? 'You have the latest version.' : result.status === 'unpublished' ? 'No published Magic release is available yet.' : 'Magic ' + result.version + ' is available.';
      if (result.status === 'available') {
        const download = document.createElement('button'); download.id = 'download-release'; download.className = 'update-glow'; download.textContent = 'Download Latest Update';
        download.onclick = async () => {
          download.disabled = true; button.disabled = true; status.textContent = 'Downloading and verifying the installer…';
          try {
            await window.magicDesktop.downloadUpdate();
            status.textContent = 'Installer verified and revealed in Downloads. Save your work, close Magic, and open the installer to update. Your local projects are preserved.';
            download.remove();
          } catch (error) { status.textContent = 'Update download failed: ' + error.message; download.disabled = false; }
          finally { button.disabled = false; }
        };
        status.after(download);
      }
    } catch (error) { status.textContent = 'Could not check updates: ' + error.message; }
    finally { button.disabled = false; }
  };
}

installRecording({ dialog, toast });

let sharedCursor = null;
$("#viewport").addEventListener(
  "pointermove",
  (e) => (sharedCursor = point(e)),
);
installSharing({
  dialog,
  toast,
  escape: esc,
  getCurrent: current,
  getProject: (id) => projects.find((p) => p.id === id),
  addProject: (p) => {
    projects.push(validateProject(p));
    activeId = p.id;
    selected.clear();
  },
  replaceProject: (id, p) => {
    const index = projects.findIndex((p) => p.id === id),
      old = projects[index];
    p = clone(p);
    p.id = id;
    p.activePage = old.activePage;
    for (const page of p.pages) {
      const previous = old.pages.find((v) => v.id === page.id);
      if (previous) page.view = previous.view;
    }
    projects[index] = validateProject(p);
    history = [];
    future = [];
  },
  getPresence: () => {
    const r = $("#viewport").getBoundingClientRect(),
      v = view();
    return {
      page: pg().id,
      cursor: sharedCursor,
      selection: [...selected],
      zoom: v.zoom,
      view: {
        x: -v.x / v.zoom,
        y: -v.y / v.zoom,
        w: r.width / v.zoom,
        h: r.height / v.zoom,
      },
    };
  },
  render,
  save,
});

function setBranchVisibility(n, value) {
  const ids = descendants(nodes(), [n.id]);
  for (const child of nodes()) if (ids.has(child.id)) child.hidden = value;
}
$("#project-name").addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    if (e.key === "Escape") e.target.value = current().name;
    e.target.blur();
  }
});
for (const event of ["keyup", "keypress"])
  $("#project-name").addEventListener(event, (e) => e.stopPropagation());

function canvasTarget(n) {
  if (!n) return n;
  const map = new Map(nodes().map((n) => [n.id, n]));
  let target = n;
  while (
    target.parent &&
    target.parent !== enteredContainer &&
    map.has(target.parent)
  )
    target = map.get(target.parent);
  return target;
}
function enterContainer(n) {
  if (!n || locked(n) || !["frame", "group"].includes(n.type)) return;
  enteredContainer = n.id;
  selected.clear();
  editingId = null;
  render();
}
function beginTextEdit(n) {
  if (locked(n) || textEditor) return;
  checkpoint();
  const input = document.createElement("textarea");
  input.id = "live-text-editor";
  input.setAttribute("aria-label", "Edit canvas text");
  input.value = n.text || "";
  textEditor = {
    id: n.id,
    input,
    original: { text: n.text, w: n.w, h: n.h },
    done: false,
  };
  $("#viewport").append(input);
  selected = new Set([n.id]);
  positionTextEditor();
  input.focus();
  input.select();
  const finish = (commit) => {
    if (!textEditor || textEditor.done) return;
    const editor = textEditor;
    editor.done = true;
    if (!commit) Object.assign(n, editor.original);
    textEditor = null;
    input.remove();
    render();
    save();
  };
  textEditor.finish = finish;
  input.oninput = () => {
    n.text = input.value;
    fitText(n);
    positionTextEditor();
    renderCanvas();
    renderInspector();
    save();
  };
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finish(true);
    }
  };
  input.onkeyup = (e) => e.stopPropagation();
  input.onpointerdown = (e) => e.stopPropagation();
  input.onclick = (e) => e.stopPropagation();
  input.onblur = () => finish(true);
  renderCanvas();
}
function positionTextEditor() {
  if (!textEditor) return;
  const n = nodes().find((n) => n.id === textEditor.id);
  if (!n) {
    textEditor.input.remove();
    textEditor = null;
    return;
  }
  const v = view(),
    color =
      paints(n, "fills").find((p) => p.visible !== false)?.color || "#e4e7eb";
  Object.assign(textEditor.input.style, {
    left: v.x + n.x * v.zoom + "px",
    top: v.y + n.y * v.zoom + "px",
    width: n.w * v.zoom + "px",
    height: n.h * v.zoom + "px",
    fontSize: (n.fontSize || 24) * v.zoom + "px",
    fontFamily: n.fontFamily || "Arial",
    fontWeight: n.fontWeight || "400",
    color,
    textAlign: n.align || "left",
    transform: "rotate(" + (n.rotation || 0) + "deg)",
  });
  const svg = $('.node[data-id="' + n.id + '"] > svg');
  if (svg) svg.style.visibility = "hidden";
}

async function exportMedia(n, format) {
  if (!window.magicDesktop?.convertMedia) {
    toast("Audio/video conversion is available in the Magic desktop app.");
    return;
  }
  dialog(
    "<h2>Convert " +
      esc(n.name) +
      " → " +
      esc(format) +
      '</h2><p id="media-stage">Preparing local conversion…</p><progress id="media-progress" max="100"></progress><p>The media engine downloads once on first use (about 109 MB), then conversion runs locally. The original stays intact.</p><button id="media-cancel">Cancel conversion</button>',
  );
  let finished = false;
  const unsubscribe = window.magicDesktop.onMediaProgress((data) => {
    const progress = $("#media-progress"),
      label = $("#media-stage");
    if (!progress || !label) return;
    label.textContent =
      data.stage +
      (data.percent !== null ? " · " + Math.round(data.percent) + "%" : "");
    if (data.percent === null) progress.removeAttribute("value");
    else progress.value = data.percent;
  });
  const cancel = () => {
    if (!finished) window.magicDesktop.cancelMedia();
  };
  $("#media-cancel").onclick = cancel;
  $("#dialog").addEventListener("close", cancel, { once: true });
  try {
    const bytes = Uint8Array.from(atob(n.src.split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
      result = await window.magicDesktop.convertMedia({
        bytes,
        name: n.name,
        format,
      });
    finished = true;
    $("#dialog").close();
    toast(result?.saved ? "Converted media saved." : "Export canceled.");
  } catch (e) {
    finished = true;
    $("#media-stage").textContent = e.message;
    $("#media-cancel").textContent = "Close";
    $("#media-cancel").onclick = () => $("#dialog").close();
  } finally {
    unsubscribe();
  }
}

function renderCommentsPanel() {
  const panel = $("#comments-panel");
  if (!panel) return;
  panel.hidden = !commentsPanelOpen;
  $("#comments-toggle").setAttribute(
    "aria-expanded",
    String(commentsPanelOpen),
  );
  if (!commentsPanelOpen) return;
  const entries = current()
    .pages.flatMap((page) =>
      page.nodes
        .filter((n) => n.type === "comment")
        .flatMap((n) => (n.comments || []).map((c) => ({ page, n, c }))),
    )
    .sort((a, b) => new Date(b.c.date) - new Date(a.c.date));
  panel.innerHTML =
    '<div class="comment-heading"><b>Comments · newest first</b><button id="comments-close" aria-label="Close comments">×</button></div>' +
    (entries.length
      ? entries
          .map(
            ({ page, n, c }) =>
              '<button class="comment-list-entry" data-comment-thread="' +
              n.id +
              '" data-comment-page="' +
              page.id +
              '"><b>' +
              esc(c.author) +
              "</b><small>" +
              esc(page.name) +
              " · " +
              esc(new Date(c.date).toLocaleString()) +
              "</small><p>" +
              esc(c.text) +
              "</p></button>",
          )
          .join("")
      : "<p>No comments yet. Use the comment tool to add one to the canvas.</p>");
}
for (const event of ["pointerdown", "wheel", "dblclick", "contextmenu"])
  $("#comments-panel").addEventListener(event, (e) => e.stopPropagation());

function guideTargets(excluded) {
  const ancestors = new Set();
  for (const id of excluded) {
    let n = nodes().find((n) => n.id === id);
    while (n?.parent) {
      ancestors.add(n.parent);
      n = nodes().find((p) => p.id === n.parent);
    }
  }
  return nodes()
    .filter(
      (n) =>
        !excluded.has(n.id) &&
        !ancestors.has(n.id) &&
        n.type !== "comment" &&
        !hidden(n),
    )
    .map(visualBounds);
}
let pageHoverTimer = null,
  pageHoverId = null,
  lastDragPointer = null;
function clearPageHover() {
  clearTimeout(pageHoverTimer);
  pageHoverTimer = null;
  pageHoverId = null;
  document
    .querySelectorAll(".page-drop-hover")
    .forEach((el) => el.classList.remove("page-drop-hover"));
}
function transferDragToPage(g, pageId, e) {
  const destination = current().pages.find((p) => p.id === pageId);
  if (!destination || destination === pg()) return;
  const source = pg();
  if (!g.items) {
    const root = nodes().find((n) => n.id === g.id);
    if (!root || locked(root)) return;
    checkpoint();
    const ids = descendants(
      nodes(),
      selected.has(root.id) ? selected : new Set([root.id]),
    );
    g.items = clone(nodes().filter((n) => ids.has(n.id)));
  }
  const ids = new Set(g.items.map((n) => n.id)),
    moving = source.nodes.filter((n) => ids.has(n.id));
  if (!moving.length) return;
  const roots = moving.filter((n) => !ids.has(n.parent));
  for (const n of roots) n.parent = null;
  source.nodes = source.nodes.filter((n) => !ids.has(n.id));
  destination.nodes.push(...moving);
  current().activePage = destination.id;
  enteredContainer = null;
  editingId = null;
  selected = new Set(roots.map((n) => n.id));
  g.transferred = true;
  alignmentGuides = [];
  dropTarget = null;
  const box = bounds(roots.map(visualBounds)),
    p = point(e);
  for (const n of moving) {
    n.x += p.x - box.x - box.w / 2;
    n.y += p.y - box.y - box.h / 2;
  }
  g.items = clone(moving);
  g.p = p;
  render();
}
window.addEventListener("pointermove", (e) => {
  const g =
    gesture?.kind === "move"
      ? gesture
      : treeDrag?.id && treeDrag.moved
        ? treeDrag
        : null;
  if (!g) {
    clearPageHover();
    return;
  }
  lastDragPointer = { clientX: e.clientX, clientY: e.clientY };
  if (g === treeDrag && g.transferred) {
    const p = point(e);
    for (const item of g.items) {
      const n = nodes().find((n) => n.id === item.id);
      if (n) {
        n.x = item.x + p.x - g.p.x;
        n.y = item.y + p.y - g.p.y;
      }
    }
    renderCanvas();
  }
  const button = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("#pages [data-page]"),
    id = button?.dataset.page;
  if (!id || id === pg().id) {
    clearPageHover();
    return;
  }
  if (id === pageHoverId) return;
  clearPageHover();
  pageHoverId = id;
  button.classList.add("page-drop-hover");
  pageHoverTimer = setTimeout(() => {
    pageHoverTimer = null;
    if ((gesture === g || treeDrag === g) && lastDragPointer)
      transferDragToPage(g, id, lastDragPointer);
  }, 450);
});
window.addEventListener(
  "pointerup",
  (e) => {
    const g = gesture?.kind === "move" ? gesture : treeDrag;
    if (g?.transferred) {
      const r = $("#viewport").getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      ) {
        const ids = new Set(g.items.map((n) => n.id)),
          moving = nodes().filter((n) => ids.has(n.id)),
          box = bounds(
            moving.filter((n) => !ids.has(n.parent)).map(visualBounds),
          ),
          v = view();
        for (const n of moving) {
          n.x += (r.width / 2 - v.x) / v.zoom - box.x - box.w / 2;
          n.y += (r.height / 2 - v.y) / v.zoom - box.y - box.h / 2;
        }
        renderCanvas();
      }
      save();
    }
    clearPageHover();
  },
  true,
);
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape" && (gesture?.transferred || treeDrag?.transferred)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      gesture = null;
      treeDrag = null;
      alignmentGuides = [];
      dropTarget = null;
      clearPageHover();
      document.body.style.cursor = "";
      restore(history, future);
    }
  },
  true,
);
let tabDrag = null,
  suppressTabClick = false;
$("#tabs").addEventListener("pointerdown", (e) => {
  const button = e.target.closest("[data-project]");
  if (e.button || !button) return;
  tabDrag = {
    id: button.dataset.project,
    startX: e.clientX,
    order: projects.map((p) => p.id),
    moved: false,
  };
});
$("#tabs").addEventListener("pointermove", (e) => {
  const g = tabDrag;
  if (!g) return;
  if (!g.moved && Math.abs(e.clientX - g.startX) < 5) return;
  if (!g.moved) {
    checkpoint();
    g.moved = true;
    $("#tabs").setPointerCapture(e.pointerId);
  }
  const others = [...$("#tabs").querySelectorAll(".tab")].filter(
    (el) => el.querySelector("[data-project]").dataset.project !== g.id,
  );
  let index = others.findIndex((el) => {
    const r = el.getBoundingClientRect();
    return e.clientX < r.x + r.width / 2;
  });
  if (index < 0) index = others.length;
  const moving = projects.find((p) => p.id === g.id),
    rest = projects.filter((p) => p.id !== g.id);
  rest.splice(index, 0, moving);
  projects = rest;
  renderTabs();
  $("#tabs")
    .querySelector('[data-project="' + g.id + '"]')
    .closest(".tab")
    .classList.add("tab-dragging");
  const r = $("#tabs").getBoundingClientRect();
  if (e.clientX > r.right - 30) $("#tabs").scrollLeft += 20;
  if (e.clientX < r.left + 30) $("#tabs").scrollLeft -= 20;
});
$("#tabs").addEventListener("pointerup", () => {
  if (tabDrag?.moved) {
    suppressTabClick = true;
    renderTabs();
    save();
    setTimeout(() => (suppressTabClick = false), 0);
  }
  tabDrag = null;
});
$("#tabs").addEventListener(
  "click",
  (e) => {
    if (suppressTabClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
function cancelTabDrag() {
  if (!tabDrag) return;
  const order = tabDrag.order;
  projects.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  if (tabDrag.moved) history.pop();
  tabDrag = null;
  renderTabs();
}
$("#tabs").addEventListener("pointercancel", cancelTabDrag);
window.addEventListener(
  "keydown",
  (e) => {
    if (e.key === "Escape" && tabDrag) {
      e.stopImmediatePropagation();
      cancelTabDrag();
    }
  },
  true,
);
