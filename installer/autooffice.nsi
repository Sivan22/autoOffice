Unicode True

!define APPNAME     "AutoOffice"
!define APPVERSION  "1.0.0"
; Stable GUID for the Word trusted-catalog entry (distinct from the add-in manifest Id)
!define CATALOG_GUID "b2c3d4e5-f6a7-8901-bcde-f12345678901"

Name "${APPNAME} Add-in for Word"
OutFile "AutoOffice-Setup.exe"
InstallDir "$LOCALAPPDATA\${APPNAME}"
RequestExecutionLevel user
ShowInstDetails show

!include "MUI2.nsh"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; ── Install ──────────────────────────────────────────────────────────────────
Section "Install"
  SetOutPath "$INSTDIR"
  File "files\manifest.xml"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Register install folder as a Word trusted add-in catalog
  WriteRegStr   HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{${CATALOG_GUID}}" "Id"    "{${CATALOG_GUID}}"
  WriteRegStr   HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{${CATALOG_GUID}}" "Url"   "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{${CATALOG_GUID}}" "Flags" 1

  ; Add entry to Programs & Features
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName"    "${APPNAME}"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion"  "${APPVERSION}"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher"       "AutoOffice"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair"  1

  MessageBox MB_OK "AutoOffice installed!$\n$\nNext steps:$\n1. Restart Microsoft Word$\n2. Go to Insert $\"Add-ins$\" $\" My Add-ins$\n3. Open the Shared Folder tab$\n4. Select AutoOffice and click Add"
SectionEnd

; ── Uninstall ────────────────────────────────────────────────────────────────
Section "Uninstall"
  Delete "$INSTDIR\manifest.xml"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"

  DeleteRegKey HKCU "Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{${CATALOG_GUID}}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
SectionEnd
