# Your first project

1. Close an older Magic window, then start the desktop app with `Start-Magic.cmd` or `dist/0.5.0/Magic-win32-x64/Magic.exe`. The entire packaged folder must stay together. To transfer browser work, export a .magic file there and import it in the desktop app.
2. Explore the sample canvas or click the top + to make an empty project.
3. Rename the project on the left. Add pages with the + beside Pages. Double-click page names to rename them.
4. Choose a shape and drag across the canvas. Hold Shift while drawing for equal width and height. Click Text and then the canvas; edit its content in the right panel.
5. Ctrl-click to toggle individual layers. Shift-click in the layer tree to select a range; crossing a frame/group boundary includes the full container. Drag a selection rectangle on empty canvas for a marquee. Click empty canvas to clear selection.
6. Use the inspector to set position, size, stacked fills/strokes, and typography. Select a container in the layer tree to move it and its children together. Double-click a shape or drawn path to edit anchors and curve handles. Double-click a layer name or the title above a frame to rename it.
7. Drag files from your desktop onto the canvas. Images appear directly; other supported media have previews or downloadable attachment cards. Double-click media to interact.
8. Place a comment with C. Type in the inline composer and press Enter or the arrow to post; Shift+Enter adds a line break. Click a pin to reply alongside the canvas. These discussions stay inside your local project.
9. Save a portable project with Ctrl+S. Use the Export panel at the bottom right for SVG/PNG/PDF/JPEG sharing. PDF and JPEG are flattened on white. Keep the .magic file for future editing. Actions contains specialized transformations, with recent/frequent tools; basic commands stay in the canvas context menu and inspector.

To bend a path, double-click it, hover an edge, then hold Ctrl and drag. Adjust the resulting handle arms directly. A normal click on the hover marker inserts a point. To trace an image, select it and run Image to Vector in Actions. Double-click the resulting vector to edit its contours. The original image stays in the project.

Right-click empty canvas and choose Customize to change the current page's canvas color. In paint stacks, use + to add, − to remove, the eye to hide, and Move above to reorder. The square opens a color picker; the hex field accepts six-digit HTML colors. Each paint has its own opacity. Stroke rows also have width and position.

## Troubleshooting

**The canvas looks empty:** click the zoom percentage to fit all content. Check visibility in the layer tree and confirm the selected project/page.

**A layer will not move:** unlock it or its parent in the layer tree. Exit media interaction by clicking outside the media. Press V to return to Move.

**An imported file is a card:** its native editor is not implemented. Download preserves the original file; a card does not imply that Magic can edit the format.

**Autosave failed:** export a .magic backup immediately. Browser storage may be unavailable or full. Do not clear browser storage until you have a backup.

**Export differs from the canvas:** SVG preserves explicit text lines rather than browser wrapping. Installed fonts, shadows, and rotated bounds can affect appearance. Use PNG for raster sharing and check the result before publishing.

**I cannot see someone else's replies:** live collaboration is not implemented. Share a project file to transfer the current discussion state.

**My browser blocks a PDF preview:** use Download original file from the inspector and open it in your PDF application.


## Selection and workspace
Selection outlines stay upright and disappear while editing vector points. A size badge shows object dimensions beneath the outline. Drag just outside a corner to rotate; hold Shift for 15-degree increments. Drag the lower-right square to resize. Clicking with a shape tool creates a 100 × 100 object; dragging sets a custom size.
Canvas box selection includes partially intersecting objects. In the Layers panel, start a selection box on blank space; dragging a row instead reorders it. Drop onto a frame/group to place it inside, onto another layer to insert before it, or onto blank space to move it to the page root. Drag the sidebar divider to widen names. Double-click the current page name to rename it.
The canvas has no background grid at normal zoom. At 800% and above it shows one-pixel cells. Zoom extends to 6400%. The circular question mark at bottom right opens the guide.

## Model interchange
Select a supported 3D attachment to expose Original, OBJ, STL, PLY, FBX and GLB in Export. The importer supports binary/ASCII FBX, OBJ, STL, glTF/GLB, PLY, DAE, 3DS and other Assimp formats. OBJ/STL/PLY/FBX export transformed triangle geometry; FBX output is ASCII 7.4. Mesh exports do not retain rigs, animation, UVs or materials. GLB retains scene features supported by Assimp's glTF exporter. Put companion files (MTL, textures, buffers) on the same page with their original names. Missing dependencies or unsupported model features are reported as conversion errors. Original files remain intact. This is conversion, not a 3D model editing viewport.

## Updates and storage
UPDATES checks the latest public GitHub release after the release repository is configured as owner/repository. Stable release tags must use vMAJOR.MINOR.PATCH and the Windows asset must be named Magic-Windows.zip. A successful current-version check says “No updates at this time.” Missing repositories, unpublished releases, and connection failures are reported separately. Confirm Download update, save/extract the portable package, close Magic, and launch the new version. Automatic replacement of a running executable is not implemented.
Project saves continue to use .magic, preserving hierarchy, edits and embedded assets. Arbitrary files may be attached, without a fixed file-size cap. Memory, disk and browser storage quotas still apply; embedded data and undo snapshots increase memory consumption. Keep portable backups for large projects.

## Text, pen and color tracing
Text wraps when you narrow its box without changing the typography size. Reducing height widens the text box when required to fit the same text at the same font size. Font changes expand the container to prevent clipping. Explicit line breaks remain intact.
Click with Pen to place an anchor; click-drag to create tangent handles. A blue snap indicator appears within eight screen pixels of an existing anchor. Click near the first anchor to close a path; Enter finishes an open path. Double-click the finished path to edit anchors and handles.
Image → vector defaults to color. Preview before creating, inspect the anchor count, and increase smoothing/detail removal to simplify. Colors are separate editable vector layers inside a group. Double-click a colored region to edit its anchors. Resolution, color count, silhouette threshold and smoothing all affect fidelity. A single curved segment can use only endpoint anchors, but complex curvature and sharp corners still require additional anchors.

## Live collaboration
Use the person-plus button at the lower left of the canvas. Enter your display name, select Host this project, and give your collaborator the invitation shown. They select Join project in their own Magic desktop app and paste the invitation. The host must be reachable on the same LAN or VPN; no hosted relay or account service is included. Windows may ask to permit Magic through the firewall. Multiple collaborators can join.
The invitation contains the session access key: anyone holding it can edit until the host stops sharing. Transport uses AES-256-GCM with a fresh connection key and ordered messages. Project changes are merged by entity and field; changes to the same field use host arrival order. Undo history is cleared on remote edits to avoid reverting another person's work. Cursor locations, selected layers and viewport outlines are shared only on the same page. Menus, dialogs, webcam and microphone are not transmitted. Each participant autosaves a local project copy; disconnecting retains it. Sharing is live while the host is open, not an offline synchronization service. Very large transfers remain constrained by memory and the transport's packet safeguards.

## Recording
Use the record button beside collaboration. Default: canvas, desktop audio, microphone, 30 fps. Choose Entire Magic interface to include Magic's panels and dialogs. Capture is locked to Magic's own web contents; other application windows cannot be selected. Desktop audio can include sounds from other applications. Webcam is opt-in, and appears as a circular overlay with adjustable diameter at the lower left. The cursor is drawn into the recording.
Click Start recording, then the square stop button when finished. Recordings stream to a temporary file and are saved through a native WebM save dialog; they are not uploaded. Device access or operating-system denial is reported, and failed startup closes opened tracks. If Magic is closed unexpectedly during recording, an unfinished magic-recording-*.webm may remain in the system temporary folder. Long recordings require free disk space. Webcam and microphone availability depend on connected devices and OS permissions.

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


## Windows installer and updates (0.10.1)
The per-user installer preserves the Magic application name and magic://app origin, so existing desktop IndexedDB projects continue in the same profile. The fixed release feed is realchasecurtis/magic. Manual update checks accept only newer stable semantic versions with an exact Magic-Setup-VERSION.exe asset and matching .sha256 file. Downloads are size/hash verified, marked with Windows ZoneId=3, and revealed for explicit user launch. Forks must change desktop/update-service.cjs to their own trusted release repository. No updater executes an installer automatically.
