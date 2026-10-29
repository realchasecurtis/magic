# Magic page handoff

Suggested route: /magic

Title: Magic — your local creative workspace

Intro: Bring files, sketches, text, and ideas together on a flexible canvas. Magic is an early, open-source Windows app for arranging, creating, annotating, and exporting visual work.

Features:
- Organize projects and pages with frames, groups, searchable files, and layers.
- Draw shapes and editable pen paths; add and format text.
- Import images and attachments, trace images into vectors, and use format-conversion actions.
- Save locally, export portable .magic projects, and export designs to SVG, PNG, JPEG, or PDF within supported content limits.
- Add comments, share a live project over LAN/VPN, and record canvas presentations.
- Extend the MIT-licensed source with your own coding assistant using the included guides.

Primary CTA: Download Magic for Windows
Secondary CTA: View source
Release: 0.11.0, Windows x64, unsigned per-user installer.
Install copy: Open Setup, follow the steps, then launch Magic from the Start menu. Optional updates are available inside the app.

Scope note: Magic is a working creative foundation. It does not provide full Adobe/Figma/Office compatibility, editable PDF pages, a spreadsheet engine, or a 3D viewport. LAN/VPN sharing is not hosted cloud collaboration. Core editing works locally; update checks and optional media-engine downloads require Internet access. The app itself does not call an AI service.

Publish only after verifying the live repository and release. Planned source URL: https://github.com/realchasecurtis/magic
Planned installer URL: https://github.com/realchasecurtis/magic/releases/download/v0.11.0/Magic-Setup-0.11.0.exe

Use only the supplied assets/mark.png and assets/wordmark.png, or a new blank/demo canvas image. Do not use desktop-preview.png, preview screenshots, or user workspace data from the original project.
## What's new in 0.11.0

- Rearrange project tabs by dragging, with a live preview of the order.
- Align items with guides and soft snapping; hold Alt for precise adjustments.
- Move items between pages by hovering over a destination page while dragging.
- Keep duplicates and imported items clear of nearby content with 10-pixel spacing.
- Edit image-heavy projects with cached previews and separate local asset storage. Portable exports retain original assets.

Performance varies with project content and hardware. Do not present the development benchmark as a universal speed guarantee. This Windows installer also retains the optional verified updater, Magic app icon, and multiword workspace-title fix from 0.10.3.
