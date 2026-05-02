; AutoOffice Word Add-in Installer
; Inno Setup Script
; https://jrsoftware.org/isinfo.php

#define MyAppName "AutoOffice for Word, Excel & PowerPoint"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AutoOffice"
#define MyAppURL "https://sivan22.github.io/autoOffice/"
#define ShareName "AutoOfficeAddin"
#define OwnSharePath "C:\AutoOfficeAddin"

[Setup]
AppId={{B2C3D4E5-F6A7-8901-BCDE-F12345678902}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
DefaultDirName={commonappdata}\AutoOfficeAddin
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=AutoOffice-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"

[Files]
Source: "..\manifest.production.xml"; DestDir: "{app}"; DestName: "manifest.xml"; Flags: ignoreversion

[Registry]
; Only register our own trusted catalog when none already exists. Office's
; per-user TrustedCatalogs parser breaks with 2+ GUID-named subkeys: it shows
; "we had a problem reading your settings" and wipes ALL entries on Word
; startup. When a catalog already exists we drop our manifest into its folder
; instead, leaving the host catalog as the single registered entry.
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; ValueType: string; ValueName: "Id"; ValueData: "{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; Flags: uninsdeletekey; Check: ShouldCreateOwnCatalog
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; ValueType: string; ValueName: "Url"; ValueData: "{code:GetNetworkPath}"; Check: ShouldCreateOwnCatalog
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; ValueType: dword; ValueName: "Flags"; ValueData: "1"; Check: ShouldCreateOwnCatalog

[Code]
var
  NetworkPath: string;
  HostCatalogUrl: string;
  UseHostCatalog: Boolean;

function GetNetworkPath(Param: string): string;
begin
  Result := NetworkPath;
end;

function GetComputerNetName: string;
begin
  Result := GetEnv('COMPUTERNAME');
  if Result = '' then
    Result := 'localhost';
end;

procedure CloseWordIfRunning;
var
  ResultCode: Integer;
begin
  Exec('taskkill', '/F /IM WINWORD.EXE', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function CreateNetworkShare(ShareName, SharePath: string): Boolean;
var
  ResultCode: Integer;
  Command: string;
begin
  Exec('net', 'share ' + ShareName + ' /delete /y', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Command := 'share ' + ShareName + '="' + SharePath + '" /GRANT:Everyone,FULL';
  Result := Exec('net', Command, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

// Return the Url of the first existing UNC-path trusted catalog, or '' if none.
function FindHostCatalogUrl: string;
var
  KeyPath: string;
  Subkeys: TArrayOfString;
  i: Integer;
  Url: string;
begin
  Result := '';
  KeyPath := 'Software\Microsoft\Office\16.0\WEF\TrustedCatalogs';
  if not RegGetSubKeyNames(HKCU, KeyPath, Subkeys) then
    Exit;
  for i := 0 to GetArrayLength(Subkeys) - 1 do
  begin
    if RegQueryStringValue(HKCU, KeyPath + '\' + Subkeys[i], 'Url', Url) then
    begin
      if (Length(Url) > 2) and (Url[1] = '\') and (Url[2] = '\') then
      begin
        Result := Url;
        Exit;
      end;
    end;
  end;
end;

procedure InitializeWizard;
begin
  NetworkPath := '\\' + GetComputerNetName + '\{#ShareName}';
  HostCatalogUrl := FindHostCatalogUrl;
  UseHostCatalog := HostCatalogUrl <> '';
end;

function ShouldCreateOwnCatalog: Boolean;
begin
  Result := not UseHostCatalog;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  TargetFile: string;
begin
  // Close Word, and (only when registering our own catalog) clear the stale
  // WEF cache and create the share BEFORE [Registry] runs, so Word never
  // sees a registry entry pointing at a not-yet-existent share.
  if CurStep = ssInstall then
  begin
    CloseWordIfRunning;
    if not UseHostCatalog then
    begin
      DelTree(ExpandConstant('{localappdata}\Microsoft\Office\16.0\Wef'), True, True, True);
      if not DirExists('{#OwnSharePath}') then
        CreateDir('{#OwnSharePath}');
      if not CreateNetworkShare('{#ShareName}', '{#OwnSharePath}') then
        MsgBox('Warning: Could not create network share. You may need to share the folder manually.', mbInformation, MB_OK);
    end;
  end;
  if CurStep = ssPostInstall then
  begin
    if UseHostCatalog then
      // Distinct filename so we never overwrite the host catalog's own manifest.
      TargetFile := HostCatalogUrl + '\autooffice.xml'
    else
      TargetFile := '{#OwnSharePath}\manifest.xml';
    if not FileCopy(ExpandConstant('{app}\manifest.xml'), TargetFile, False) then
      MsgBox('Warning: Could not copy manifest to share folder: ' + TargetFile, mbInformation, MB_OK);
    // Record where we placed the manifest so the uninstaller can remove it.
    RegWriteStringValue(HKCU, 'Software\AutoOffice\Installer', 'ManifestPath', TargetFile);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  ManifestPath: string;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    // Remove only the manifest we placed; never touch a catalog/share we
    // didn't create.
    if RegQueryStringValue(HKCU, 'Software\AutoOffice\Installer', 'ManifestPath', ManifestPath) then
    begin
      if FileExists(ManifestPath) then
        DeleteFile(ManifestPath);
      RegDeleteKeyIncludingSubkeys(HKCU, 'Software\AutoOffice');
    end;
    // If the standalone share/folder exists, it was created by us.
    if DirExists('{#OwnSharePath}') then
    begin
      Exec('net', 'share {#ShareName} /delete /y', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if MsgBox('Remove the shared folder ({#OwnSharePath})?', mbConfirmation, MB_YESNO) = IDYES then
        DelTree('{#OwnSharePath}', True, True, True);
    end;
  end;
end;

[Messages]
FinishedLabel=ההתקנה הסתיימה בהצלחה.%n%nכדי להשתמש בתוסף ב-Word, Excel או PowerPoint:%n%n1. פתח את Microsoft Word, Excel או PowerPoint%n2. עבור לעמוד הבית > תוספות%n3. לחץ על "תיקייה משותפת" בחלק התחתון%n4. בחר "AutoOffice" והקלק הוסף

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
