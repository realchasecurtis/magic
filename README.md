# Magic

A local, open-source creative workspace: collect files on a visual canvas, arrange frames and groups, draw, annotate, and export. Magic is an early working foundation for a broader creative suite, not yet a replacement for Adobe, Figma, or Office.

## Windows desktop app

Download **Magic-Setup-0.11.0.exe** from the official release, open it, and follow Setup. Magic installs for your Windows user, adds a Start-menu shortcut, offers an optional desktop shortcut, and appears in Windows Installed apps for uninstalling. Node and a web server are not required. This release is unsigned. Windows may display its normal publisher/reputation prompt.

Updates are optional: open Updates, choose **Check for Updates**, then **Download Latest Update** when offered. Magic checks the official GitHub release, verifies the installer checksum, and reveals the download. Save your work and close Magic before opening Setup. Nothing installs automatically. Setup reuses the same installation folder and Magic profile; uninstalling leaves project data intact. Export important projects as .magic backups.

Official release destination reserved for this build: https://github.com/realchasecurtis/magic/releases (publication is pending). Do not advertise this as a working download until the publisher creates the repository and uploads the release.

For a portable development build, open `dist/0.11.0/Magic-win32-x64/Magic.exe` or `Start-Magic.cmd`.

The desktop app keeps a separate local workspace from browser previews. To transfer existing work, save a `.magic` project in the preview and import it in the app. The supplied cyan mark and wordmark are used in the toolbar, favicon, and header.

For source development, install Node.js 22+, then run `pnpm install` and `pnpm desktop`. If your package manager skips Electron's installation script, run `node node_modules/electron/install.js`. Build with `pnpm package:desktop`. The lockfile records the tested dependency versions.

## Optional browser preview

Install Node.js 22 or newer, download or clone this folder, and run:

```sh
node server.mjs
```

Open **http://127.0.0.1:4173** in a current desktop Chromium browser (Chrome or Edge). No npm install, account, API key, build step, external fonts, or cloud service is required. The server binds only to your local machine. Stop it with Ctrl+C. Do not use `file://` to open index.html: ES modules and local storage require an HTTP origin.

On Windows you can also double-click `Start-WebPreview.cmd`. Keep its terminal open while using the browser preview.

The source can also be hosted as static files. `server.mjs` is a local development server, not a production public hosting service. Publishing a public deployment is not included in this repository setup.

## Workspace hierarchy

**Project tabs → Pages → Frames → Groups → Layers.** Frames and groups are optional containers; a page may also contain loose layers. Nested groups are supported. Every project owns its pages and each page owns its layer tree and viewport. Click a top tab to switch projects, or + to create another. Edit the project name in the left panel. Double-click a page name to rename it.

Container membership is explicit (`parent` IDs). Drawing inside a frame or dropping a moved layer fully inside a frame assigns it to that frame. Group/frame commands organize selections; the inspector does not expose a hierarchy selector. Moving a frame or group moves all descendants. Resizing a frame changes its boundary, not the size of its contents. Groups derive their bounds from their children. Frames do not clip children in this release.

## Editing improvements in 0.3

- Export is pinned at the bottom of the right bar. Choose SVG, PNG, PDF, or JPEG for the selection, or the whole page when nothing is selected. PDF and JPEG flatten the design against white; PDF contains a raster image at 96 pixels per inch (72 points per inch). SVG preserves editable vectors; PNG supports transparency.
- Actions is a searchable library of specialized transformations: Image to Vector and Remove Background, with persistent Recent and Most used sections. Basic editing commands (group, frame, flatten, vector editing, shadow) are in the canvas context menu/inspector, not Actions.
- Double-click shapes or pen/pencil paths to edit their anchors. Drag points and handles; click an edge to insert a point; Alt-click or Delete a selected point to remove it. Toggle curve handles in the inspector, and finish with Escape or Done editing. Ellipses and rounded rectangles retain cubic curves when converted.
- Pen drawing shows placed vertices and the pending segment before finishing. Enter commits the path.
- Ctrl-click toggles individual layers. Shift-click in the layer tree selects a range in the common container. Crossing a container boundary includes that full container and its descendants; selecting siblings within it leaves its parent unselected.
- Double-click a layer name or frame title to rename it inline; right-click Rename and F2 are also supported.
- Shape and drawing submenus include icons and remember the active choice, including Triangle.
- Right-click empty canvas for Paste, Actions, and Customize. Canvas color is saved per page.
- Fill and stroke stacks support adding, removing, hiding, reordering, hex colors, opacity, and stroke weight/position. Top rows paint above lower rows. Open paths use centered strokes.
- Hover a vector edge to see the insertion target. Ctrl-drag (Command-drag on macOS) bends the edge and creates editable Bézier handles. All handles remain visible in vector-edit mode.
- The in-app color picker previews saturation, brightness, hue, hex, and paint changes live. A continuous adjustment is one undo step; Escape in the picker cancels its changes.
- Comments compose and reply inline beside canvas pins, without a modal. They follow pan/zoom and stay within the viewport.
- Project tabs align with the canvas divider. Toolbar icons, dropdown spacing, frame-title editing, and paint-row spacing have been refined, and the supplied replacement M logo is in use.

## Working features

| Area | Current behavior |
| --- | --- |
| Workspace | Multiple project tabs and pages, rename, search, layer tree, collapse/expand, show/hide, lock/unlock |
| Canvas | Pan, zoom, fit, multi-select, marquee selection, move, resize, rotation, opacity, alignment |
| Shapes | Rectangle, ellipse, polygon, star, line, arrow, fill, stroke, rounded rectangles, soft shadow |
| Drawing | Click-point pen paths; continuous freehand pencil paths |
| Text | Editable multiline text, size, weight, font, fill, alignment |
| Organization | Frames, nested groups, container release, copy/paste, paste to replace, duplicate, stacking, flips |
| Comments | Author, timestamp, hover preview, replies stored in the project |
| Actions | Editable color tracing and silhouette contours; flat edge-connected background removal |
| Persistence | IndexedDB autosave, session undo/redo, portable `.magic` JSON files with embedded assets |

## Files and format support

- Images (including SVG): inline display, transforms, export, and color/silhouette tracing. SVGs are displayed as images, not editable individual vector paths.
- PDF: browser-native preview where supported, plus original-file download. PDF pages and contents are not editable.
- Audio and video are attachment cards with original-file export and conversion actions; there is no in-app playback.
- Office documents, 3D models, and other files: visual attachment cards, movable and organizable on the canvas, with original-file download. Model conversion uses bundled Assimp WebAssembly. FBX (binary and ASCII), OBJ, STL, glTF/GLB, PLY, DAE and other supported inputs can export to OBJ/STL/PLY/ASCII FBX or GLB. Mesh exports flatten geometry; GLB retains supported scene data. Original assets remain embedded. No 3D rendering, spreadsheet calculation, Word editing, or slide editing is implemented yet.
- No application-imposed per-file size cap. Browser storage quota and device memory may limit total project size. Embedded files increase JSON size. Keep exported backups.

PDFs, videos, audio, attachment cards, and comments are omitted from SVG exports. PNG export/flatten requires a selection containing only design layers and images; the app reports unsupported selections. PNG export is limited to 32 million pixels. SVG text exports preserve explicit line breaks; browser wrapping and installed fonts can differ between applications. Rotated or shadowed objects may extend outside the current export bounds.

Image tracing uses a local worker and color quantization to create native editable Bézier layers, including holes. Color count, smoothing, detail removal and resolution are adjustable with a preview and anchor count. Higher smoothing removes anchors at the cost of fidelity; photographs become posterized vector artwork rather than lossless copies. Silhouette modes remain available. Original images are retained. Background removal handles flat edge-connected backgrounds and is not AI subject extraction. Pen click-drag creates Bézier handles and zoom-aware snapping.

## Shortcuts

| Action | Key |
| --- | --- |
| Move / Frame / Shape / Pen / Text / Comment | V / F / R / P / T / C |
| Pan | Space + drag, or middle-button drag |
| Zoom | Wheel or top controls |
| Toggle individual layer | Ctrl + click |
| Select range in layer tree | Shift + click |
| Finish pen / cancel | Enter / Escape |
| Copy / paste / paste to replace | Ctrl+C / Ctrl+V / Ctrl+Shift+V |
| Duplicate / select all | Ctrl+D / Ctrl+A |
| Group / release container | Ctrl+G / Ctrl+Shift+G |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Bring forward to top / send to bottom | ] / [ |
| Nudge / larger nudge | Arrow / Shift+Arrow |
| Save project / open project | Ctrl+S / Ctrl+O |
| Delete selection | Delete or Backspace |

Command substitutes for Ctrl on macOS. Copy/paste uses Magic’s internal selection clipboard. System file imports use the import button or drag and drop.

## Save, share, and recover

Autosave is local to this browser profile and origin. Clearing browser data removes the workspace. The save indicator reports storage failure. Use **Save project** for a portable `.magic` file, then open it with **Open .magic project** or drag it onto the canvas. Imports create a separate project tab. Closing a project tab removes its locally stored project after an explicit confirmation; export first. Undo can restore a closed tab during the session.

Comments travel with project files and shared project changes. Desktop collaboration supports simultaneous editing over LAN/VPN. There is no cloud identity verification, cloud storage, or publishing backend. A static export can be shared manually. No content is sent to an AI or external service.

## Tests and development

```sh
node --test tests/model.test.js tests/upgrade.test.js tests/refinement.test.js
```

Browser smoke tests require Playwright installed separately and the local server running:

```sh
node tests/browser-smoke.mjs
node tests/upgrade-browser.mjs
node tests/refinement-browser.mjs
node tests/actions-browser.mjs
node tests/desktop-smoke.mjs
```

For an existing browser, set `MAGIC_BROWSER_CHANNEL=msedge` or `chrome`. For a shared Playwright install, set `MAGIC_PLAYWRIGHT_PATH` to its `index.mjs`. These optional test dependencies are not needed to run Magic.

Read [the architecture](docs/ARCHITECTURE.md), [user guide](docs/USER-GUIDE.md), and [AI extension guide](docs/AI-EXTENSION-GUIDE.md) before making changes. Contributions are welcome under the [MIT license](LICENSE).

## Version 0.6: direct editing and media

Double-click text to edit directly on the canvas. Enter inserts a line break; Ctrl+Enter or clicking outside commits, and Escape cancels. Pages rename inline with a double-click. Spaces remain normal characters in frame/group titles. In the workspace project-name field, Space or Enter confirms and leaves the field.

Frames and groups protect their children: select the container first, then double-click to enter it. Escape exits. The breadcrumb identifies the current editing scope. The context menu offers Ungroup for a selected group. Toggling a container's visibility applies to every descendant: showing it reveals even children that were individually hidden. Dragging into a frame shows a placement outline and previews the item above its contents before inserting it at the top.

Fill and stroke color editors include live opacity beneath Hue. Video and audio have native playback controls; playback survives canvas redraws.

Desktop media exports support audio MP3, WAV, FLAC, OGG and M4A, and video MP4, MOV, WebM and MKV. Video can also export its audio to MP3/WAV when an audio track exists. Export Original preserves the imported bytes. The first conversion downloads the pinned FFmpeg 9.0.2 Windows engine (about 109 MiB) from Gyan, verifies SHA-256, and caches it in the app's user-data folder. Later conversions run locally and offline. Download and conversion progress are shown with a Cancel control. A native save dialog follows successful conversion. Browser preview does not run the desktop converter. Re-encoding can change quality, metadata, and stream contents; video conversion keeps the first video and optional first audio track. FFmpeg is separately licensed under GPLv3; its upstream license and documentation remain with the downloaded engine. It is not bundled in Magic's source or app package.


## Templates, previews, fonts, and recording (0.7)

Select a frame to find Template between its name and Position & dimensions. There are 29 presets for print (300 pixels/inch), social posts, stories, thumbnails, banners, avatars, screens and icons, plus a width/height swap. Applying a template changes the frame size without scaling its contents. Social presets are reusable aspect-ratio starting points; destination-specific crops may differ.

Image to Vector opens with an automatic result preview and the original image. Changing parameters recalculates after a short pause; Preview / recalculate remains available. Remove Background shows original and transparent result together on a checkerboard and updates with color/tolerance changes. This remains edge-connected color removal, not AI subject segmentation.

The recording setup has microphone and camera device selectors. Refresh devices / preview requests access and displays available device labels. Enabling the webcam shows a muted circular preview; during recording it remains live at the lower left of the canvas and is captured with Magic. Preview tracks stop when setup closes or recording starts; recording tracks stop on finish. Device access may depend on Windows permissions. No microphone audio is played through speakers during preview.

Typography includes icon alignment controls and a searchable font browser. Bundled fonts: Inter, Lora, Nunito, Oswald, Dancing Script, JetBrains Mono and Bebas Neue. They are licensed under the SIL Open Font License, not public domain; their original license notices are included under assets/fonts. These fonts work offline. Drop TTF, OTF, WOFF or WOFF2 files into Add your typeface, or use its file chooser. Imported fonts are named from their filenames and embedded in the project, autosave and .magic export; import only fonts you have rights to share. Loaded fonts are embedded in SVG exports and the raster export source. Available font families include the bundled families, project imports and the existing system fallback choices; this is not an OS-wide installed-font scanner.

## Interaction refinements (0.8)
Pencil remains active after each stroke until Enter or Escape (or choosing another tool); completed strokes remain separate editable layers. Audio/video now appear only as attachment cards, with no in-app playback. Original export and audio/video conversions remain available. Resize accounts for rotation and anchors the opposite upright selection corner. Near diagonal rotations, where independent upright dimensions cannot be achieved while preserving the rotation, resizing uses proportional scaling to avoid unstable jumps. The recording setup is wider, has constrained compact dropdowns, and stacks at narrow widths without horizontal scrolling. Mouse toolbar use no longer leaves a focus outline on inactive tools; keyboard focus remains visible. Share and Guide buttons use centered SVG icons.

### Locate layers (0.8.1)
Use the crosshair immediately left of a layer’s visibility eye to center that layer and zoom to fit its upright bounds with canvas padding. It selects the layer and enters its parent container. Hidden layers stay hidden; use the eye to reveal them.

## Background and export reliability (0.9)
Locate now reveals the target and its hidden parent chain without unhiding unrelated siblings. Group and Ungroup are both present in layer context menus. The tracing dialog uses a responsive two-column form and explains Existing transparency outline (formerly Transparency silhouette): it traces existing alpha, not a photo subject.

Remove Background no longer has a color picker. It estimates the dominant border color, limits region growth at sharp color boundaries, and offers a Keep Object brush on the preview plus Clear Protection. This is local edge-aware segmentation, not a trained semantic model: similar-color subjects, textured backgrounds and objects touching image edges may still require manual correction.

Media conversion now verifies output streams, checks duration against the source, and decodes the entire output before presenting Save. Validation is cancellable and displayed as a progress stage. The selected file extension is enforced and video output uses 8-bit 4:2:0 pixels for wider compatibility. Full decode detects file corruption but cannot guarantee every external player supports the chosen container/codec. Automated tests cover MOV/WebM/MKV to MP4 round trips as well as audio outputs.

### WebM conversion checks (0.9.1)
Video exports select a real video stream rather than an attached cover image. Full output validation now requires decoded video frames and retention of source audio when present. Tests convert VP8, VP9, and 10-bit VP9 WebM to MP4, verify frame counts/codecs, and check visible playback in Edge. These samples pass; the reported audio-only export remains un-reproduced without the affected source/output files and player details.

### Explicit media export choice (0.9.2)
Video export options are separated into Video + audio and Audio only. The export button names the selected format, audio-only exports explain that the picture is removed, and the choice persists across panel refreshes within the session. A supplied WebM recording was verified through the desktop MP4 export UI, producing 198 H.264 frames and AAC sound. The reported failed output was confirmed to be a genuine MP3 audio file; the reason for the earlier format selection could not be established. Set MAGIC_WEBM_INPUT to run the optional exact-file desktop regression test.

## Text, comments and setup controls (0.10)
New text starts white and opens for direct canvas editing. Editing the Typography text field updates the canvas immediately; canvas typing updates the sidebar. Clicking empty canvas commits text and saves it. Existing text colors are unchanged.

Comments are excluded from the Layers tree. Use Project comments beside Record to browse comments and replies across project pages, newest first. Selecting an entry navigates to its page and opens the discussion. Canvas comment markers retain a readable screen size across zoom levels. Comments still travel with saved/shared projects.

Invitation has a separate row below Host this project. Webcam diameter updates the setup preview and its pixel label live; the actual recording overlay uses the selected diameter. On narrow windows, the preview fits the available width while retaining its circular shape.


## Windows installer and updates (0.11.0)
The per-user installer preserves the Magic application name and magic://app origin, so existing desktop IndexedDB projects continue in the same profile. The fixed release feed is realchasecurtis/magic. Manual update checks accept only newer stable semantic versions with an exact Magic-Setup-VERSION.exe asset and matching .sha256 file. Downloads are size/hash verified, marked with Windows ZoneId=3, and revealed for explicit user launch. Forks must change desktop/update-service.cjs to their own trusted release repository. No updater executes an installer automatically.


Version 0.11.0 adds live project-tab reordering, alignment guides with Alt snap bypass, hover-to-transfer between Pages, clear 10-pixel duplicate/import spacing, and cached image rendering with separate device asset storage to reduce persistent image-heavy project lag. Portable .magic exports retain original assets.
