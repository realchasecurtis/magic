# Releasing Magic for Windows

The original source project is MIT licensed. Preserve LICENSE, bundled vendor licenses, and typeface license files. The application uses supplied Magic artwork. Do not include user profiles, screenshots, test output, local settings, or runtime caches in a public repository.

1. Install the locked development dependencies with pnpm; build with `pnpm package:desktop`.
2. Compile `packaging/magic.iss` with Inno Setup, passing `/DAppVersion=VERSION` when changing versions. Keep AppId and application/profile names unchanged across upgrades.
3. Generate a SHA-256 file named exactly `Magic-Setup-VERSION.exe.sha256`, containing the lowercase digest, two spaces, and `Magic-Setup-VERSION.exe`.
4. Create a stable GitHub release tagged `vVERSION` in **realchasecurtis/magic**, then attach the installer and checksum. Both are required by the updater. The repository is not yet published by this preparation task.
5. Verify the public release and installer before linking the download from trywoo.app. Future updates must use the same repository and asset naming convention, or ship a coordinated updater configuration change.

Builds can reuse an installed packager via MAGIC_PACKAGER_MODULE and a cached Electron ZIP folder via MAGIC_ELECTRON_ZIP_DIR. These optional environment variables are local build inputs and must not be checked in with personal paths.

Installer verification should include a fresh per-user install, update over an existing install, shortcut launch, and uninstall while confirming saved projects remain. Automated packaged-app persistence tests do not substitute for the full installer lifecycle test. No signing identity is configured by this task.
## Windows icon repair (0.10.2)

The previous executable inherited Electron's embedded icon despite the window using Magic's PNG. This release embeds the supplied transparent Magic artwork at 16, 24, 32, 48, 64, 128, and 256 pixels in the executable and Setup. Windows uses the ICO for the app window, and both shortcuts explicitly use the executable icon and the matching app.trywoo.magic AppUserModelID. The installation AppId, app name, profile, and update repository are unchanged. No Windows icon caches are cleared.

Regenerate assets/magic.ico with scripts/create-icon.ps1. Verify built PE resources using scripts/verify-icons.mjs with MAGIC_RESEDIT_MODULE pointing to the installed resedit module when necessary. UninstallDisplayIcon points to the branded executable; Inno Setup derives the uninstaller icon from SetupIconFile.

## Workspace title typing (0.10.3)
Space now inserts ordinary whitespace in the project/workspace title. Enter commits, Escape restores the saved name, and clicking away commits. Composing IME keystrokes are not treated as commit/cancel commands. Naming keyboard events do not bubble to canvas shortcuts. No additional icon changes: installed 0.10.2 executable and live window icons were confirmed as Magic.
