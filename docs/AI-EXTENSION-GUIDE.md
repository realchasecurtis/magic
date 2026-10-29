# Extend Magic with your own AI

You own this source. Copy the project, open it with your coding assistant, and give it a narrowly scoped change request. No special AI provider is required. The application itself does not connect to an AI service.

## A useful request template

> Read README.md, docs/ARCHITECTURE.md, and CONTRIBUTING.md. I want [specific behavior]. When I [user action], Magic should [visible result]. The feature should work in project tabs and survive save/export/import. Keep existing version-1 projects readable. Build the real behavior, including inspector controls, undo/redo, keyboard handling, and errors where relevant. Add focused tests, run the existing tests, and report remaining limitations. Do not add cloud dependencies or send files externally without asking me.

Example:

> Add an OBJ 3D preview adapter. An imported OBJ should show an orbitable wireframe in its canvas bounds and retain its original bytes. Orbit only in an explicit preview mode so dragging still moves the card. Preserve the asset in .magic exports. Explain what happens to unsupported materials. Test malformed OBJ data and reopening a saved project.

Another example:

> Add vector boolean operations: union and subtract. Keep existing anchors and Bézier handles editable. Support SVG export, bounds, undo/redo, and page switching. Include project fixtures with overlapping curved paths and explain how self-intersections are handled.

## What to give the AI

1. The behavior you need, with a concrete before/after example.
2. A sample file you have permission to use, stripped of sensitive data where possible.
3. Constraints: offline support, file size, supported browsers, dependencies, and accessibility.
4. Acceptance checks, including what should happen on failure.

## Feature checklist

- Define real model data rather than UI-only state.
- Keep project/page ownership and parent references valid.
- Register the node type in validation if a new type is introduced.
- Render it on canvas and add useful inspector fields.
- Include copy/paste, movement, hierarchy, delete, undo, and save behavior.
- Specify import/export fidelity and unsupported formats clearly.
- Test a portable export/import roundtrip and malformed input.
- Update user documentation and disclose limits inside the relevant flow.

Review the AI’s diff and tests before distributing your version. Do not paste credentials into a project or commit private files. MIT licensing allows modification and distribution; retain the license notice. Publishing a release or deploying an integration is a separate action from making local code changes.

Selection UI is an unrotated sibling overlay in app.js; never attach its outline to the transformed artwork. curve-fit.js fits sampled contours into cubic vertices. mesh.js implements geometry-only OBJ/STL reading and OBJ/STL/PLY writing; expose only supported conversions. Desktop update IPC validates repository names and permits downloading only the asset from the checked release.

Use vendor/assimp and vendor/imagetracer for conversion; keep licenses and worker isolation. Do not expose general desktop capture: recording must target only the Magic main frame. Do not add private menus, device streams or local viewport state to shared project patches. Test multiple desktop instances with separate MAGIC_TEST_PROFILE paths; tests bind collaboration to loopback and fake-device flags prevent camera/mic access. Same-field conflicts use host order; do not advertise this as a full offline CRDT.

### Templates and typefaces
Edit `src/inspector-extras.js` for the preset catalog, font picker, and font import. Preserve embedded project fonts through round trips and collaboration. `src/render.js` embeds registered fonts in exports; fonts must load before rasterization. Keep original typeface licenses in `assets/fonts`. Test with `tests/inspector7-browser.mjs`. Recording preview permission is scoped by `record-preview` IPC and must be revoked when its dialog closes.


## Windows installer and updates (0.10.1)
The per-user installer preserves the Magic application name and magic://app origin, so existing desktop IndexedDB projects continue in the same profile. The fixed release feed is realchasecurtis/magic. Manual update checks accept only newer stable semantic versions with an exact Magic-Setup-VERSION.exe asset and matching .sha256 file. Downloads are size/hash verified, marked with Windows ZoneId=3, and revealed for explicit user launch. Forks must change desktop/update-service.cjs to their own trusted release repository. No updater executes an installer automatically.
