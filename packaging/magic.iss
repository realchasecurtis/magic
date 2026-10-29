#ifndef AppVersion
  #define AppVersion "0.10.3"
#endif
[Setup]
AppId={{F4BCC425-72BA-49DC-873B-C842693E1699}
AppName=Magic
AppVersion={#AppVersion}
AppPublisher=Magic contributors
DefaultDirName={localappdata}\Programs\Magic
DefaultGroupName=Magic
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=Magic-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\magic.ico
UninstallDisplayIcon={app}\Magic.exe
CloseApplications=yes
RestartApplications=no
LicenseFile=..\LICENSE
[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked
[Files]
Source: "..\dist\{#AppVersion}\Magic-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Magic"; Filename: "{app}\Magic.exe"; IconFilename: "{app}\Magic.exe"; AppUserModelID: "app.trywoo.magic"
Name: "{autodesktop}\Magic"; Filename: "{app}\Magic.exe"; IconFilename: "{app}\Magic.exe"; AppUserModelID: "app.trywoo.magic"; Tasks: desktopicon
[Run]
Filename: "{app}\Magic.exe"; Description: "Open Magic"; Flags: nowait postinstall skipifsilent unchecked
