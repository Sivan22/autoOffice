; AutoOffice Word Add-in Installer
; Inno Setup Script
; https://jrsoftware.org/isinfo.php

#define MyAppName "AutoOffice Add-in"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AutoOffice"
#define MyAppURL "https://sivan22.github.io/autoOffice/"
#define ShareName "AutoOfficeAddin"

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
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; ValueType: string; ValueName: "Id"; ValueData: "{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; ValueType: string; ValueName: "Url"; ValueData: "{code:GetNetworkPath}"
Root: HKCU; Subkey: "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{{B2C3D4E5-F6A7-8901-BCDE-F12345678903}"; ValueType: dword; ValueName: "Flags"; ValueData: "1"

[Code]
var
  SharePath: string;
  NetworkPath: string;

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

function CopyManifestToShare: Boolean;
var
  SourceFile, DestFile: string;
begin
  SourceFile := ExpandConstant('{app}\manifest.xml');
  DestFile := SharePath + '\manifest.xml';
  Result := FileCopy(SourceFile, DestFile, False);
end;

procedure InitializeWizard;
begin
  SharePath := 'C:\AutoOfficeAddin';
  NetworkPath := '\\' + GetComputerNetName + '\{#ShareName}';
end;

function InitializeSetup: Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    CloseWordIfRunning;
    DelTree(ExpandConstant('{localappdata}\Microsoft\Office\16.0\Wef'), True, True, True);
    if not DirExists(SharePath) then
      CreateDir(SharePath);
    if not CreateNetworkShare('{#ShareName}', SharePath) then
      MsgBox('Warning: Could not create network share. You may need to share the folder manually.', mbInformation, MB_OK);
    if not CopyManifestToShare then
      MsgBox('Warning: Could not copy manifest to share folder.', mbInformation, MB_OK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    Exec('net', 'share {#ShareName} /delete /y', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    if MsgBox('Remove the shared folder (C:\AutoOfficeAddin)?', mbConfirmation, MB_YESNO) = IDYES then
      DelTree('C:\AutoOfficeAddin', True, True, True);
  end;
end;

[Messages]
FinishedLabel=ההתקנה הסתיימה בהצלחה.%n%nכדי להשתמש בתוסף:%n%n1. פתח את Microsoft Word%n2. עבור לעמוד הבית > תוספות%n3. לחץ על "תיקייה משותפת" בחלק התחתון%n4. בחר "AutoOffice" והקלק הוסף

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
