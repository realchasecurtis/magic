# Contributing to Magic

Use focused changes with a concrete user outcome. Read the architecture and AI extension guide first. Keep runtime setup dependency-free unless a feature clearly justifies a dependency; document its license and offline impact.

Run `node --test tests/model.test.js`. For UI changes, run `tests/browser-smoke.mjs` with Playwright and inspect a desktop-size render. Check keyboard behavior, project/page switching, undo/redo, local save, and export/import. Never claim a format is editable when it only has a preview.

Preserve version-1 project compatibility. Add explicit migrations for schema changes. Treat names, text, assets, URLs, and imported JSON as untrusted. Do not add telemetry, remote assets, external AI calls, or automatic publishing as incidental dependencies.

Describe the problem, changed behavior, validation, and known limitations in your contribution. Contributions are licensed under MIT.
