# Architecture

Magic uses browser modules for its editor and Electron for the desktop shell. HTML/CSS make the interface, positioned DOM elements provide the canvas, and SVG renders design primitives. Local persistence uses IndexedDB. Desktop assets load through the local `magic://app/` protocol, without an HTTP server. The optional preview uses a small Node server. The renderer has no Node access; context isolation and sandboxing are enabled. External navigation and new windows are blocked.

## Source map

- `index.html`: application shell and stable controls.
- `style.css`: panel, toolbar, canvas, inspector, and dialog styling.
- `src/model.js`: object factories, hierarchy traversal, copying, validation, starter content.
- `src/render.js`: SVG primitives, escaping, export serialization.
- `src/vector.js`: cubic paths, conversion, edge splitting, coordinate conversion, bounds normalization, container-aware selection ranges.
- `src/image-actions.js`: native contour tracing and edge-connected background removal.
- `src/color-picker.js`: non-modal live HSV/hex paint controls.
- `src/comments.js`: anchored inline discussions that survive canvas redraws.
- `src/pdf-export.js`: a byte-offset-safe single-image PDF writer for flattened exports.
- `theme.css`: dark neutral and cyan branding, paint stacks, and vector controls.
- `assets/`: supplied logo files.
- `desktop/main.cjs`: desktop lifecycle, local protocol, window, and download dialogs.
- `scripts/package-desktop.mjs`: portable Windows packaging.
- `src/app.js`: UI state, commands, interactions, imports, persistence, actions.
- `server.mjs`: loopback-only static development server.
- `tests/model.test.js`: pure model and serialization tests.
- `tests/browser-smoke.mjs`: actual browser interaction and persistence tests.

## Data model

The workspace is `{ projects, activeId }`. A project is `{ id, name, pages, activePage }`. A page is `{ id, name, nodes, view: { x, y, zoom } }`.

Layers are flat records with a nullable `parent` ID. Coordinates are absolute page coordinates, including children. Containers do not establish a separate coordinate system. Each node has ID, type, name, x/y, width/height (`w`, `h`), rotation, opacity, fill, stroke, stroke width, hidden, locked, and parent fields. Media use embedded data URLs in `src`. Drawing paths store points normalized to their own bounding box. Text and comments have type-specific content fields.

The current portable envelope is `{ format: "magic", version: 3, project }`. Version 1 and 2 imports remain supported: legacy `fill`, `stroke`, and `strokeWidth` are interpreted as single paint stacks until edited. Version 2 added editable vectors, ordered paints, and page backgrounds. Version 3 introduces compound vector contours via vertex `breakBefore` flags, retaining holes with even-odd filling. Future versions must implement explicit migrations and fixtures. The import validator checks dimensions, vector coordinates, paints, allowed types, embedded sources, valid parents, and cycles. Imported data must always be treated as untrusted. Avoid `innerHTML` with unescaped user values and never execute imported markup as a document.

Vector vertices use normalized coordinates and optional absolute normalized `in`/`out` Bézier control points. Edge splitting uses de Casteljau subdivision. Geometry is rebased after vertex gestures to update layer dimensions without moving the path in world space. Shape, text, and vector paint stacks share the same SVG renderer on canvas and in exports; top paint rows render last. Inside strokes use clips, outside strokes use masks; open paths use centered strokes.

Specialized transformations are registered in `actionTools` in app.js. Keep basic editing in canvas commands and the inspector. Usage counts and timestamps, plus chosen shape/drawing tools, are stored in `magic-preferences` in localStorage. Workspace documents remain in IndexedDB. Browser and desktop origins have separate stores by design.

## Commands and interaction

`change(fn)` takes a history snapshot, applies a mutation, renders, and saves. Pointer gestures snapshot once, update interactively, then commit on release. Undo/redo snapshots include the whole workspace; at most 60 undo steps are retained. This is deliberately simple and may consume significant memory with large assets. A later asset store and command-delta history should replace snapshots before scaling to large projects.

Rendering walks containers before descendants to preserve hierarchy painting. Hidden and locked flags inherit through ancestors. Group bounds are recomputed from children. A container’s move propagates to descendants. Container resizing, rotation, and scaling do not currently provide a complete nested transform system; avoid assuming these have Figma-equivalent semantics.

## Extension boundaries

Add a format adapter with explicit import, render, inspector, export, and validation behavior. Do not label a preview as editable support. Keep user content local unless a user explicitly invokes an external integration.

Future multi-user work requires server persistence, verified identities, authorization, a conflict-resolution model, and asset synchronization. Comment author labels in the current application are simply text fields. They cannot be used as trusted identities.

A scalable asset store, structured rich text, spreadsheet/formula engines, editable PDFs, 3D viewport adapters, and authenticated publishing should be separate milestones with acceptance tests. Windows packaging is implemented; signing and installers are future release tasks.

## Creation and sessions (0.5)
text-layout.js shares measured wrapping between canvas/export and adjusts text boxes without changing font size. trace-worker.js runs bundled ImageTracer and translates quadratic paths into editable cubic anchors. model-worker.js uses bundled Assimp WASM and scene-mesh.js for transformed mesh interchange. Vendor licenses are in vendor/.
Recording uses an explicitly armed main-frame-only display-media handler, permission-scoped camera/microphone access, renderer canvas cropping/cursor compositing, MediaRecorder, and main-process sequential writes to a temporary file.
Collaboration uses an encrypted TCP host/join channel in desktop/collaboration.cjs. project-sync.js diffs and applies per-entity field changes; the host validates and orders edits. sharing.js sends only project data and explicit presence, never DOM, screen content or menus. This is LAN/VPN collaboration without NAT traversal, a hosted relay, accounts or durable cloud storage.

### Media conversion (0.6)
`desktop/media-conversion.cjs` manages a pinned, SHA-256 checked FFmpeg download and shell-free conversion with explicit demuxers and a restricted protocol whitelist. `desktop/media-ipc.cjs` accepts only the main renderer frame, permits one conversion at a time, relays progress, supports cancellation, saves through a native dialog, and removes temporary media. `desktop/media-engine.json` pins the version, URL, and checksum. Keep the upstream license alongside the runtime cache. `tests/media6.mjs` exercises codecs/playback and `tests/media6-desktop.mjs` exercises IPC/save. Tests use an explicitly isolated profile and engine override.


## Windows installer and updates (0.10.1)
The per-user installer preserves the Magic application name and magic://app origin, so existing desktop IndexedDB projects continue in the same profile. The fixed release feed is realchasecurtis/magic. Manual update checks accept only newer stable semantic versions with an exact Magic-Setup-VERSION.exe asset and matching .sha256 file. Downloads are size/hash verified, marked with Windows ZoneId=3, and revealed for explicit user launch. Forks must change desktop/update-service.cjs to their own trusted release repository. No updater executes an installer automatically.
