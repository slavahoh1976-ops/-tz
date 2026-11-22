; LED Pixel Mask Generator — установщик для Windows 10/11 (Inno Setup 6).
; Ставится для текущего пользователя в AppData\Local\Programs без прав администратора,
; поэтому обновление из самой программы проходит тихо, без окна UAC.
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "LED Pixel Mask Generator"

[Setup]
AppId={{D9E1CDB3-4417-4B0E-B962-99101BDE1707}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=slavahoh1976-ops
AppPublisherURL=https://slavahoh1976-ops.github.io/-tz/
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=LED-Pixel-Mask-Generator-Setup
OutputDir=..\..\dist-setup
SetupIconFile=app.ico
UninstallDisplayIcon={app}\{#AppName}.exe
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
MinVersion=10.0

[Languages]
Name: "ru"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: "desktopicon"; Description: "Ярлык на рабочем столе"; GroupDescription: "Ярлыки:"

[Files]
Source: "..\..\dist\{#AppName}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; старые файлы прошлой версии (кроме данных пользователя — они в %APPDATA%)
Type: filesandordirs; Name: "{app}\_internal"

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppName}.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppName}.exe"; Description: "Запустить {#AppName}"; Flags: nowait postinstall
