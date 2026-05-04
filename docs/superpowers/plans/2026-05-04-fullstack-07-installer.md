# Local full-stack — Plan 07: Installer extension

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `installer/setup.iss` to ship the bun-compiled `autoOffice-server.exe` alongside the existing manifest, run the binary's `--first-run-init` once during install (cert + token + DB), register a Scheduled Task that auto-starts the service at logon as the install user, and update `manifest.production.xml` to point at `https://localhost:47318/`. Preserve the existing Trusted Catalog logic (host-catalog detection, network share creation, manifest drop-in) untouched.

**Architecture:** The installer remains admin (network share + scheduled task creation need it). New steps slot in before/after the existing `[Registry]` and `CurStepChanged` blocks. Uninstall reverses all new steps in addition to the existing manifest cleanup.

**Tech Stack:** Inno Setup (existing), `schtasks.exe` for Scheduled Task creation, `autoOffice-server.exe --first-run-init` and `--cert-uninstall` subcommands.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Installer (Inno Setup)".

---

## File structure after this plan

```
installer/
└── setup.iss                          MODIFIED (extended)

manifest.production.xml                MODIFIED (SourceLocation → https://localhost:47318)

apps/server/src/cli/
├── index.ts                           MODIFIED (add --cert-uninstall)
└── cert-uninstall.ts                  NEW

.github/workflows/
└── installer.yml                      NEW (build installer in CI)
```

---

## Task 1: Add `--cert-uninstall` subcommand

**Files:**
- Create: `apps/server/src/cli/cert-uninstall.ts`
- Modify: `apps/server/src/cli/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Implement**

`apps/server/src/cli/cert-uninstall.ts`:
```ts
import { uninstallCertByFingerprint } from '../tls/install-store';
import { loadConfig } from '../lifecycle/config';
import { resolveDataDir } from '../env';

export async function certUninstall(): Promise<void> {
  const cfg = loadConfig(resolveDataDir());
  if (!cfg?.certFingerprint) {
    console.log('[autoOffice] no fingerprint to remove.');
    return;
  }
  await uninstallCertByFingerprint(cfg.certFingerprint);
  console.log('[autoOffice] cert removed from CurrentUser\\Root');
}
```

- [ ] **Step 2: Wire into `cli/index.ts`**

Replace `apps/server/src/cli/index.ts`:
```ts
export type Command = 'first-run-init' | 'rotate-token' | 'cert-uninstall' | 'serve';

export function parseArgv(argv: string[]): Command {
  const args = argv.slice(2);
  if (args.includes('--first-run-init')) return 'first-run-init';
  if (args.includes('--rotate-token')) return 'rotate-token';
  if (args.includes('--cert-uninstall')) return 'cert-uninstall';
  return 'serve';
}
```

- [ ] **Step 3: Wire into `index.ts`**

In `apps/server/src/index.ts`, just below the existing `if (cmd === 'rotate-token')`, add:
```ts
if (cmd === 'cert-uninstall') {
  const { certUninstall } = await import('./cli/cert-uninstall');
  await certUninstall();
  process.exit(0);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/cli apps/server/src/index.ts
git commit -m "feat(server/cli): --cert-uninstall removes the cert by stored fingerprint"
```

---

## Task 2: Update production manifest URL

**Files:**
- Modify: `manifest.production.xml`

- [ ] **Step 1: Replace `SourceLocation` and `Taskpane.Url`**

Open `manifest.production.xml`. Replace every occurrence of `https://sivan22.github.io/autoOffice/` with `https://localhost:47318/`. Specifically:

- Line ~26: `<SourceLocation DefaultValue="https://sivan22.github.io/autoOffice/" />` → `<SourceLocation DefaultValue="https://localhost:47318/" />`
- Line ~153: `<bt:Url id="Taskpane.Url" DefaultValue="https://sivan22.github.io/autoOffice/" />` → `<bt:Url id="Taskpane.Url" DefaultValue="https://localhost:47318/" />`

Keep `IconUrl`, `HighResolutionIconUrl`, `LearnMoreUrl`, and `SupportUrl` pointing at GitHub Pages — those are remote assets we still want hosted (and they get served by the landing site after plan 09).

- [ ] **Step 2: Commit**

```bash
git add manifest.production.xml
git commit -m "feat(manifest): production SourceLocation → https://localhost:47318"
```

---

## Task 3: Edit `setup.iss` — `[Files]` and `[Run]`

**Files:**
- Modify: `installer/setup.iss`

- [ ] **Step 1: Add the binary to `[Files]`**

Find the existing `[Files]` section and add a second entry:
```ini
[Files]
Source: "..\manifest.production.xml"; DestDir: "{app}"; DestName: "manifest.xml"; Flags: ignoreversion
Source: "..\apps\server\dist\autoOffice-server.exe"; DestDir: "{app}"; Flags: ignoreversion
```

- [ ] **Step 2: Run `--first-run-init` after install**

Add a `[Run]` section near the bottom (above `[Messages]`):
```ini
[Run]
Filename: "{app}\autoOffice-server.exe"; Parameters: "--first-run-init"; Flags: runhidden waituntilterminated; StatusMsg: "Initializing AutoOffice (cert + token) ..."
Filename: "schtasks.exe"; Parameters: "/Create /F /SC ONLOGON /TN ""AutoOffice\Service"" /TR ""\""{app}\autoOffice-server.exe\"""" /RL LIMITED"; Flags: runhidden waituntilterminated; StatusMsg: "Registering AutoOffice Service ..."
Filename: "schtasks.exe"; Parameters: "/Run /TN ""AutoOffice\Service"""; Flags: runhidden waituntilterminated; StatusMsg: "Starting AutoOffice Service ..."
```

> **Note:** the `\"` escapes are required so the path is quoted within the schtasks `/TR` argument. Verify by running the produced installer once and checking that Task Scheduler shows `AutoOffice\Service` with the expected command.

- [ ] **Step 3: Add `[UninstallRun]` to reverse**

Add below `[UninstallDelete]`:
```ini
[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/End /TN ""AutoOffice\Service"""; Flags: runhidden; RunOnceId: "stoptask"
Filename: "schtasks.exe"; Parameters: "/Delete /F /TN ""AutoOffice\Service"""; Flags: runhidden; RunOnceId: "deltask"
Filename: "{app}\autoOffice-server.exe"; Parameters: "--cert-uninstall"; Flags: runhidden; RunOnceId: "certrm"
```

- [ ] **Step 4: Commit**

```bash
git add installer/setup.iss
git commit -m "feat(installer): ship bun binary + --first-run-init + Scheduled Task at logon"
```

---

## Task 4: Optional — confirm before wiping data dir on uninstall

**Files:**
- Modify: `installer/setup.iss`

- [ ] **Step 1: Add a `CurUninstallStepChanged` branch that prompts**

Find the existing `CurUninstallStepChanged` procedure (it removes the manifest copy). Append after the existing block, before the closing `end;`:
```pas
    if MsgBox('Also remove your AutoOffice data folder (chat history, settings, provider keys)?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      DelTree(ExpandConstant('{localappdata}\AutoOffice'), True, True, True);
    end;
```

- [ ] **Step 2: Commit**

```bash
git add installer/setup.iss
git commit -m "feat(installer): uninstall offers to wipe %LOCALAPPDATA%\\AutoOffice"
```

---

## Task 5: Build the installer locally (manual)

**Files:** None.

- [ ] **Step 1: From a Windows machine with Inno Setup 6 installed**

```powershell
npm install
npm --workspace @autooffice/server run build
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\setup.iss
```
Expected: `installer/output/AutoOffice-Setup.exe` is produced.

- [ ] **Step 2: Run the installer on a clean Windows VM**

(VHD/Hyper-V/VirtualBox snapshot of Windows 10 or 11 with Office 365 installed, no AutoOffice ever installed.)

- Run as admin.
- Expected: cert prompt may appear; click Yes.
- Expected: `Task Scheduler → AutoOffice\Service` exists, status Running.
- Expected: `https://localhost:47318/health` returns `{ ok: true }` from a browser on the VM.

- [ ] **Step 3: Sideload Word**

Open Word → Home → Add-ins → Advanced → Shared Folder → AutoOffice → Add. Expected: task pane loads from `https://localhost:47318/` without certificate errors.

- [ ] **Step 4: Uninstall**

Settings → Apps → AutoOffice → Uninstall. Expected: scheduled task removed, cert removed, data folder prompt shown, manifest removed from share.

- [ ] **Step 5: Take notes for plan 10**

Note any UX rough edges (e.g. "cert prompt confused me") for the smoke checklist in plan 10.

---

## Task 6: CI installer job

**Files:**
- Create: `.github/workflows/installer.yml`

- [ ] **Step 1: Build job for the installer on Windows runners**

`.github/workflows/installer.yml`:
```yaml
name: installer

on:
  push:
    branches: [feat/local-fullstack]
  workflow_dispatch:

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: npm ci
      - run: npm --workspace @autooffice/web run build
      - run: npm --workspace @autooffice/server run build
      - name: Install Inno Setup
        run: choco install -y innosetup
      - name: Build installer
        run: '& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\setup.iss'
      - uses: actions/upload-artifact@v4
        with:
          name: AutoOffice-Setup
          path: installer/output/AutoOffice-Setup.exe
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/installer.yml
git commit -m "ci: build Windows installer artifact on feat/local-fullstack"
git push
```

- [ ] **Step 3: Watch the run**

Open Actions for the branch. Expected: `installer / build-windows` job goes green and uploads `AutoOffice-Setup.exe`.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: bun binary in `[Files]`, `--first-run-init` in `[Run]`, scheduled task creation, manifest URL update, uninstall reverses (task / cert / optional data) — all present.
- [x] Existing Trusted Catalog logic in setup.iss is untouched. Verified by re-reading the file before editing.
- [x] No TODO/TBD placeholders.
- [x] CI Windows job builds the installer end-to-end on every push to the migration branch.
- [x] Manual smoke checklist deferred to plan 10 (which produces the durable smoke-checklist doc).
- [x] No references to identifiers from later plans except the smoke-checklist note.
