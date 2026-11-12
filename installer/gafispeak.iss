#define AppName "GafiSpeak"
#define AppVersion "1.0.0"
#define AppPublisher "GafiPro"
#define ManagerExe "GafiSpeak Manager.exe"

[Setup]
AppId={{B4E3BD11-1A56-4E4B-9B75-3B2D5B3B7D61}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\GafiSpeak
DefaultGroupName=GafiSpeak
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
OutputDir=..\release
OutputBaseFilename=GafiSpeak-Setup-{#AppVersion}
SetupIconFile=..\desktop\build\icon.ico
UninstallDisplayIcon={app}\{#ManagerExe}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
Uninstallable=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar um atalho no ambiente de trabalho"; GroupDescription: "Atalhos adicionais:"; Flags: unchecked

[Files]
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\requirements-tts.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\.env.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\scripts\deploy-commands.js"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "bootstrap.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "..\desktop\dist\GafiSpeak-Manager-1.0.0-Portable.exe"; DestDir: "{app}"; DestName: "{#ManagerExe}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\GafiSpeak\GafiSpeak Manager"; Filename: "{app}\{#ManagerExe}"; WorkingDir: "{app}"
Name: "{autoprograms}\GafiSpeak\GafiSpeak - Configurar"; Filename: "{sys}\notepad.exe"; Parameters: """{app}\.env"""; WorkingDir: "{app}"
Name: "{autoprograms}\GafiSpeak\README"; Filename: "{app}\README.md"
Name: "{autodesktop}\GafiSpeak"; Filename: "{app}\{#ManagerExe}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\bootstrap.ps1"""; StatusMsg: "A instalar Node.js, Python, PyTorch e Kokoro..."; Flags: waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}\.runtime"
Type: filesandordirs; Name: "{app}\.venv"
Type: filesandordirs; Name: "{app}\node_modules"
Type: files; Name: "{app}\install.log"
