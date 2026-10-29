@echo off
cd /d "%~dp0"
if exist "dist\0.11.0\Magic-win32-x64\Magic.exe" (
  start "Magic" "dist\0.11.0\Magic-win32-x64\Magic.exe"
  exit /b 0
)
if exist "dist\Magic-win32-x64\Magic.exe" (
  start "Magic" "dist\Magic-win32-x64\Magic.exe"
  exit /b 0
)
if exist "node_modules\electron\dist\electron.exe" (
  start "Magic" "node_modules\electron\dist\electron.exe" "%~dp0."
  exit /b 0
)
echo Download the Windows desktop package and run Magic.exe.
echo For source development, install packages with pnpm install, then run pnpm desktop.
pause
