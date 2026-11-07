[Setup]
AppId={{9B77DE62-87E7-42E3-83EC-1F6A991F17C4}
AppName=Maquetario
AppVersion=3.24.0
AppPublisher=Sebastián Poberezny
DefaultDirName={localappdata}\Programs\Maquetario
DefaultGroupName=Maquetario
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\..\Maquetario\Instalador
OutputBaseFilename=Maquetario-Instalar-3.24
SetupIconFile=app\maquetario.ico
UninstallDisplayIcon={app}\Maquetario.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern dark
WizardImageFile=installer-brand\welcome.bmp
WizardSmallImageFile=installer-brand\mark.bmp
DisableWelcomePage=no
ShowLanguageDialog=no
DisableProgramGroupPage=yes
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Messages]
spanish.WelcomeLabel1=Instalá Maquetario
spanish.WelcomeLabel2=Maquetación y diseño editorial.%n%nEl asistente preparará Maquetario y su acceso directo en esta computadora.
english.WelcomeLabel1=Install Maquetario
english.WelcomeLabel2=Editorial design and page layout.%n%nSetup will prepare Maquetario and its shortcut on this computer.
portuguese.WelcomeLabel1=Instale o Maquetario
portuguese.WelcomeLabel2=Design editorial e diagramação.%n%nO assistente instalará o Maquetario e seu atalho neste computador.

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; Flags: checkedonce

[Files]
Source: "..\..\Maquetario\Maquetario-3.24.exe"; DestDir: "{app}"; DestName: "Maquetario.exe"; Flags: ignoreversion
Source: "installer-tools\MicrosoftEdgeWebview2Setup.exe"; Flags: dontcopy

[Icons]
Name: "{group}\Maquetario"; Filename: "{app}\Maquetario.exe"
Name: "{autodesktop}\Maquetario"; Filename: "{app}\Maquetario.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Maquetario.exe"; Description: "Abrir Maquetario"; Flags: nowait postinstall skipifsilent

[Code]
function HasWebView: Boolean;
var Version: String;
begin
  Result := (RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
  if not Result then
    Result := (RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0'));
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Result := '';
  if not HasWebView then begin
    ExtractTemporaryFile('MicrosoftEdgeWebview2Setup.exe');
    if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, Code) then begin
      Result := 'No se pudo iniciar Microsoft WebView2. Revisá la conexión a Internet y volvé a intentar.';
      exit;
    end;
    if not HasWebView then
      Result := 'Maquetario necesita Microsoft WebView2. Conectate a Internet y volvé a iniciar el instalador.';
  end;
end;
