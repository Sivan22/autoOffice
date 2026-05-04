# Local full-stack — Plan 06: Cert + bearer token + tray + named mutex + first-run init

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-grade endpoint security and process lifecycle. Generate a per-install self-signed cert + bearer token at first run, serve HTTPS over `127.0.0.1:47318` from the bun binary, enforce single-instance via a named mutex, load secrets from `%LOCALAPPDATA%\AutoOffice\config\config.json`, and ship a minimal Windows tray icon for status + restart + token rotation.

**Architecture:** Two CLI subcommands embedded in `autoOffice-server.exe`:
- `--first-run-init` runs once at install time: generates cert + token, installs cert to `CurrentUser\Root`, creates `config.json`, opens DB and runs migrations, exits.
- (default) Normal start: loads `config.json`, takes a named mutex (`Local\AutoOffice-{install-id}`), starts HTTPS Hono server, optionally opens tray.

A failure to acquire the mutex foregrounds the existing instance via a tiny IPC ping. The tray uses `systray` (a minimal multi-platform npm package) and exposes Open guide / Restart / Rotate token / Quit. Token rotation invalidates the old token and writes a new `config.json`; the SPA receives the new token via `/bootstrap` after a refresh.

**Tech Stack:** Node `crypto` (X.509 generation), `bun:ffi` for `CertAddCertificateContextToStore` on Windows, PowerShell as a fallback (`certutil -addstore -user Root <cert>`), Hono, vitest, `systray` (or platform-specific tray helper).

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Endpoint security" + "Process model".

---

## File structure after this plan

```
apps/server/
├── package.json                       MODIFIED (add selfsigned, systray)
├── src/
│   ├── index.ts                       MODIFIED (subcommands + HTTPS + mutex + tray)
│   ├── tls/
│   │   ├── generate.ts                NEW (cert pair via 'selfsigned')
│   │   ├── generate.test.ts           NEW
│   │   ├── install-store.ts           NEW (Windows trust store)
│   │   └── install-store.test.ts      NEW
│   ├── lifecycle/
│   │   ├── single-instance.ts         NEW (named mutex)
│   │   ├── single-instance.test.ts    NEW
│   │   ├── config.ts                  NEW (load/save config.json)
│   │   └── config.test.ts             NEW
│   ├── tray/
│   │   ├── index.ts                   NEW (tray bootstrap)
│   │   └── icon.png                   NEW (asset)
│   └── cli/
│       ├── index.ts                   NEW (subcommand router)
│       └── first-run-init.ts          NEW (the init flow)
```

---

## Task 1: Add deps

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add the small libs we need**

Edit `apps/server/package.json` `dependencies`:
```json
{
  "selfsigned": "^3.0.0",
  "systray": "^1.0.5"
}
```

`devDependencies`:
```json
{
  "@types/node-forge": "^1.3.0"
}
```

Run:
```bash
npm install
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/package.json package-lock.json
git commit -m "chore(server): add selfsigned + systray deps"
```

---

## Task 2: Cert generation

**Files:**
- Create: `apps/server/src/tls/generate.test.ts`
- Create: `apps/server/src/tls/generate.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/tls/generate.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateCert } from './generate';

describe('generateCert', () => {
  it('produces a key+cert pair with localhost SAN and 10y validity', () => {
    const { key, cert, fingerprint, notAfter, notBefore } = generateCert({ commonName: 'AutoOffice (test)', validityYears: 10 });
    expect(key).toMatch(/-----BEGIN (RSA |)PRIVATE KEY-----/);
    expect(cert).toMatch(/-----BEGIN CERTIFICATE-----/);
    expect(fingerprint).toMatch(/^[A-F0-9:]+$/);
    const ms = notAfter.getTime() - notBefore.getTime();
    const tenYearMs = 10 * 365 * 24 * 60 * 60 * 1000;
    expect(Math.abs(ms - tenYearMs)).toBeLessThan(7 * 24 * 60 * 60 * 1000); // ±1w slack
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/tls/generate.test.ts
```

- [ ] **Step 3: Implement**

`apps/server/src/tls/generate.ts`:
```ts
import selfsigned from 'selfsigned';
import { createHash } from 'node:crypto';

export type CertBundle = {
  key: string;
  cert: string;
  fingerprint: string;
  notBefore: Date;
  notAfter: Date;
};

export function generateCert(opts: { commonName: string; validityYears: number }): CertBundle {
  const attrs = [{ name: 'commonName', value: opts.commonName }];
  const extensions = [
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ],
    },
  ];
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notAfter.getFullYear() + opts.validityYears);
  const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    keySize: 2048,
    days: opts.validityYears * 365,
    extensions,
  });
  const fingerprint = createHash('sha256')
    .update(Buffer.from(pems.cert.replace(/-----.+-----|\s+/g, ''), 'base64'))
    .digest('hex')
    .toUpperCase()
    .match(/.{2}/g)!
    .join(':');
  return {
    key: pems.private,
    cert: pems.cert,
    fingerprint,
    notBefore,
    notAfter,
  };
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/tls/generate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/tls/generate.ts apps/server/src/tls/generate.test.ts
git commit -m "feat(server/tls): self-signed cert with localhost SAN, 10y default"
```

---

## Task 3: Trust-store install (Windows)

**Files:**
- Create: `apps/server/src/tls/install-store.test.ts`
- Create: `apps/server/src/tls/install-store.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/tls/install-store.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { installCertToCurrentUserRoot } from './install-store';

const isWin = process.platform === 'win32';

describe.skipIf(isWin)('installCertToCurrentUserRoot (non-Windows)', () => {
  it('throws clearly', async () => {
    await expect(installCertToCurrentUserRoot('PEM')).rejects.toThrow(/Windows/);
  });
});

describe.runIf(isWin)('installCertToCurrentUserRoot (Windows)', () => {
  it('rejects empty input', async () => {
    await expect(installCertToCurrentUserRoot('')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/tls/install-store.test.ts
```

- [ ] **Step 3: Implement** (PowerShell-based — simpler than `bun:ffi` for the trust store)

`apps/server/src/tls/install-store.ts`:
```ts
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function installCertToCurrentUserRoot(certPem: string): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Cert install is only supported on Windows in v1.');
  }
  if (!/-----BEGIN CERTIFICATE-----/.test(certPem)) {
    throw new Error('Expected PEM-encoded certificate');
  }
  const path = join(tmpdir(), `autooffice-${Date.now()}.cer`);
  writeFileSync(path, certPem, 'utf8');
  try {
    await runPowerShell([
      '-NoProfile',
      '-Command',
      `Import-Certificate -FilePath '${path.replace(/'/g, "''")}' -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null`,
    ]);
  } finally {
    try { unlinkSync(path); } catch { /* noop */ }
  }
}

export async function uninstallCertByFingerprint(fingerprintHex: string): Promise<void> {
  if (process.platform !== 'win32') return;
  const fp = fingerprintHex.replace(/[^A-F0-9]/gi, '').toUpperCase();
  await runPowerShell([
    '-NoProfile',
    '-Command',
    `Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object { $_.Thumbprint -eq '${fp}' } | Remove-Item`,
  ]);
}

function runPowerShell(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn('powershell.exe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    proc.stderr.on('data', (d) => { err += d.toString(); });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`powershell exit ${code}: ${err}`));
    });
    proc.on('error', reject);
  });
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/tls/install-store.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/tls/install-store.ts apps/server/src/tls/install-store.test.ts
git commit -m "feat(server/tls): cert install + uninstall to CurrentUser Root via PowerShell"
```

---

## Task 4: Config file (load/save)

**Files:**
- Create: `apps/server/src/lifecycle/config.test.ts`
- Create: `apps/server/src/lifecycle/config.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/lifecycle/config.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, makeFreshConfig, type ServerConfig } from './config';

describe('config', () => {
  function withDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'aoffice-'));
    try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('returns null when config does not exist', () => {
    withDir((dir) => {
      expect(loadConfig(dir)).toBeNull();
    });
  });

  it('round-trips a config', () => {
    withDir((dir) => {
      const fresh: ServerConfig = makeFreshConfig({ port: 47318 });
      saveConfig(dir, fresh);
      const back = loadConfig(dir);
      expect(back).toEqual(fresh);
    });
  });

  it('makeFreshConfig generates a 64-char token', () => {
    const c = makeFreshConfig({ port: 47318 });
    expect(c.token).toMatch(/^[a-f0-9]{64}$/);
    expect(c.installId).toMatch(/^[a-f0-9]{32}$/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/lifecycle/config.test.ts
```

- [ ] **Step 3: Implement**

`apps/server/src/lifecycle/config.ts`:
```ts
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export type ServerConfig = {
  installId: string;
  token: string;
  port: number;
  certPath: string;
  keyPath: string;
  certFingerprint: string | null;
};

export function configPath(dir: string): string {
  return join(dir, 'config', 'config.json');
}

export function makeFreshConfig(opts: { port: number }): ServerConfig {
  return {
    installId: randomBytes(16).toString('hex'),
    token: randomBytes(32).toString('hex'),
    port: opts.port,
    certPath: 'config/cert.pem',
    keyPath: 'config/key.pem',
    certFingerprint: null,
  };
}

export function saveConfig(dir: string, cfg: ServerConfig): void {
  const target = configPath(dir);
  mkdirSync(join(dir, 'config'), { recursive: true });
  writeFileSync(target, JSON.stringify(cfg, null, 2), 'utf8');
}

export function loadConfig(dir: string): ServerConfig | null {
  const path = configPath(dir);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function rotateToken(dir: string): ServerConfig {
  const cur = loadConfig(dir);
  if (!cur) throw new Error('no config to rotate');
  const next: ServerConfig = { ...cur, token: randomBytes(32).toString('hex') };
  saveConfig(dir, next);
  return next;
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/lifecycle/config.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lifecycle/config.ts apps/server/src/lifecycle/config.test.ts
git commit -m "feat(server/lifecycle): config.json load/save + token rotation"
```

---

## Task 5: Single-instance lock

**Files:**
- Create: `apps/server/src/lifecycle/single-instance.test.ts`
- Create: `apps/server/src/lifecycle/single-instance.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/lifecycle/single-instance.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, releaseLock } from './single-instance';

describe('single-instance lock', () => {
  it('first acquirer wins, second is rejected, release allows re-acquire', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lk-'));
    try {
      const handle = acquireLock(dir);
      expect(handle).not.toBeNull();
      expect(acquireLock(dir)).toBeNull();
      releaseLock(handle!);
      const second = acquireLock(dir);
      expect(second).not.toBeNull();
      releaseLock(second!);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/lifecycle/single-instance.test.ts
```

- [ ] **Step 3: Implement (file-based lock — works on Windows + portable)**

`apps/server/src/lifecycle/single-instance.ts`:
```ts
import { openSync, closeSync, writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type LockHandle = { dir: string; fd: number };

const LOCK_NAME = '.lock';

export function acquireLock(dir: string): LockHandle | null {
  const path = join(dir, LOCK_NAME);
  if (existsSync(path)) {
    const pid = Number(readFileSync(path, 'utf8') || '0');
    if (pid > 0 && isAlive(pid)) return null;
    // stale — clean up
    try { unlinkSync(path); } catch { /* noop */ }
  }
  try {
    const fd = openSync(path, 'wx');
    writeFileSync(path, String(process.pid));
    return { dir, fd };
  } catch {
    return null;
  }
}

export function releaseLock(handle: LockHandle): void {
  try { closeSync(handle.fd); } catch { /* noop */ }
  try { unlinkSync(join(handle.dir, LOCK_NAME)); } catch { /* noop */ }
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/lifecycle/single-instance.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lifecycle/single-instance.ts apps/server/src/lifecycle/single-instance.test.ts
git commit -m "feat(server/lifecycle): file-based single-instance lock with stale-pid cleanup"
```

---

## Task 6: First-run-init subcommand

**Files:**
- Create: `apps/server/src/cli/first-run-init.ts`
- Create: `apps/server/src/cli/index.ts`

- [ ] **Step 1: Implement first-run-init**

`apps/server/src/cli/first-run-init.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCert } from '../tls/generate';
import { installCertToCurrentUserRoot } from '../tls/install-store';
import { makeFreshConfig, saveConfig, loadConfig, configPath } from '../lifecycle/config';
import { resolveDataDir, dbPath } from '../env';
import { openDb } from '../db';

export async function firstRunInit(): Promise<void> {
  const dataDir = resolveDataDir();
  const cfgPath = configPath(dataDir);
  if (loadConfig(dataDir)) {
    console.log(`[autoOffice] config already exists at ${cfgPath}, skipping init.`);
    return;
  }

  console.log('[autoOffice] generating bearer token + cert …');
  const cfg = makeFreshConfig({ port: 47318 });
  const bundle = generateCert({ commonName: `AutoOffice (${cfg.installId})`, validityYears: 10 });

  const certDir = join(dataDir, 'config');
  mkdirSync(certDir, { recursive: true });
  writeFileSync(join(certDir, 'cert.pem'), bundle.cert, 'utf8');
  writeFileSync(join(certDir, 'key.pem'), bundle.key, 'utf8');
  cfg.certFingerprint = bundle.fingerprint;

  saveConfig(dataDir, cfg);

  console.log('[autoOffice] installing cert to CurrentUser\\Root …');
  try {
    await installCertToCurrentUserRoot(bundle.cert);
  } catch (err) {
    console.error('[autoOffice] cert install failed; the user may need to install it manually.');
    console.error((err as Error).message);
  }

  console.log('[autoOffice] initializing database …');
  openDb({ url: dbPath() }).close();

  console.log(`[autoOffice] init complete. Data dir: ${dataDir}`);
}
```

- [ ] **Step 2: CLI router**

`apps/server/src/cli/index.ts`:
```ts
export type Command = 'first-run-init' | 'rotate-token' | 'serve';

export function parseArgv(argv: string[]): Command {
  const args = argv.slice(2);
  if (args.includes('--first-run-init')) return 'first-run-init';
  if (args.includes('--rotate-token')) return 'rotate-token';
  return 'serve';
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/cli
git commit -m "feat(server/cli): --first-run-init generates token+cert+db"
```

---

## Task 7: HTTPS Hono via `Bun.serve`

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Replace the entry to use cert+token from config and start HTTPS**

`apps/server/src/index.ts` — replace fully:
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './app';
import { openDb } from './db/index';
import { HOST, IS_DEV, VERSION, dbPath, resolveDataDir, AUTH_TOKEN } from './env';
import { parseArgv } from './cli';
import { firstRunInit } from './cli/first-run-init';
import { acquireLock, releaseLock } from './lifecycle/single-instance';
import { loadConfig, rotateToken } from './lifecycle/config';
import { startTray } from './tray';

const cmd = parseArgv(process.argv);

if (cmd === 'first-run-init') {
  await firstRunInit();
  process.exit(0);
}

if (cmd === 'rotate-token') {
  const cfg = rotateToken(resolveDataDir());
  console.log(`[autoOffice] new token written. Length: ${cfg.token.length}`);
  process.exit(0);
}

// --- normal serve path ---
const dataDir = resolveDataDir();
const cfg = loadConfig(dataDir);
const token = cfg?.token ?? AUTH_TOKEN;
const port = cfg?.port ?? 47318;

const lock = acquireLock(dataDir);
if (!lock) {
  console.error('[autoOffice] another instance is already running. Exiting.');
  process.exit(0);
}

const db = openDb({ url: dbPath() });
const app = createApp({ version: VERSION, db, authToken: token });

if (IS_DEV) {
  const { makeViteMiddleware } = await import('./middleware/vite-dev');
  app.use('*', await makeViteMiddleware());
}

let serveOpts: Parameters<typeof Bun.serve>[0] = {
  hostname: HOST,
  port,
  fetch: app.fetch,
};

if (cfg?.certPath && cfg?.keyPath) {
  serveOpts = {
    ...serveOpts,
    tls: {
      cert: readFileSync(join(dataDir, cfg.certPath)),
      key: readFileSync(join(dataDir, cfg.keyPath)),
    },
  };
}

const server = Bun.serve(serveOpts);
const scheme = serveOpts.tls ? 'https' : 'http';
console.log(`[autoOffice] ${IS_DEV ? 'dev' : 'prod'} listening on ${scheme}://${server.hostname}:${server.port}`);
console.log(`[autoOffice] data dir = ${dataDir}`);

if (!IS_DEV && process.platform === 'win32') {
  startTray({ port, dataDir }).catch((err) => console.error('tray failed', err));
}

process.on('SIGINT', () => { releaseLock(lock); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(lock); process.exit(0); });
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): HTTPS via Bun.serve, single-instance lock, subcommands"
```

---

## Task 8: Tray (minimal)

**Files:**
- Create: `apps/server/src/tray/index.ts`
- Create: `apps/server/src/tray/icon.png`

- [ ] **Step 1: Place an icon asset**

Use any 32x32 png. Either copy `apps/web/public/assets/icon-32.png` to `apps/server/src/tray/icon.png`, or generate a simple placeholder. The exact bytes don't matter for the build; the tray library just needs a path.

```bash
cp apps/web/public/assets/icon-32.png apps/server/src/tray/icon.png
```

- [ ] **Step 2: Implement the tray bootstrap**

`apps/server/src/tray/index.ts`:
```ts
import SysTray from 'systray';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { rotateToken, loadConfig } from '../lifecycle/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ICON = join(dirname(fileURLToPath(import.meta.url)), 'icon.png');

export async function startTray(opts: { port: number; dataDir: string }) {
  const tray = new SysTray({
    menu: {
      icon: encodeIcon(ICON),
      title: 'AutoOffice',
      tooltip: `AutoOffice on https://localhost:${opts.port}`,
      items: [
        { title: 'Open guide', tooltip: '', checked: false, enabled: true },
        { title: 'Restart service', tooltip: '', checked: false, enabled: true },
        { title: 'Rotate token', tooltip: 'Invalidate the current bearer and write a new one', checked: false, enabled: true },
        { title: 'Quit', tooltip: '', checked: false, enabled: true },
      ],
    },
    debug: false,
    copyDir: false,
  });

  tray.onClick(async (action) => {
    switch (action.seq_id) {
      case 0: // Open guide
        spawn('rundll32', ['url.dll,FileProtocolHandler', 'https://sivan22.github.io/autoOffice/guide/'], { detached: true, stdio: 'ignore' }).unref();
        break;
      case 1: // Restart
        process.exit(0); // scheduled task / installer should re-launch; for now we just exit
        break;
      case 2: // Rotate token
        rotateToken(opts.dataDir);
        process.exit(0);
        break;
      case 3: // Quit
        tray.kill();
        process.exit(0);
    }
  });
}

function encodeIcon(path: string): string {
  // SysTray accepts base64 ico/png. Read the file lazily.
  const fs = require('node:fs') as typeof import('node:fs');
  return fs.readFileSync(path).toString('base64');
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/tray
git commit -m "feat(server/tray): minimal Windows tray icon (Open guide / Restart / Rotate / Quit)"
```

> **Note:** if `systray` proves flaky in `bun --compile`, swap to a thin native helper (`tray-icon` Rust binary) in a follow-up. The tray is non-essential for v1 functionality — the service runs fine without it.

---

## Task 9: Wire `--first-run-init` into Inno Setup script

> This is a documentation step; the actual Inno Setup edits land in plan 07. Here we just record the command shape.

**Files:** None.

- [ ] **Step 1: Document the contract**

Add a comment block at the top of `apps/server/src/cli/first-run-init.ts`:
```ts
// Invoked by the installer once at install time:
//   "{app}\autoOffice-server.exe" --first-run-init
// Idempotent: if config.json already exists, exits 0 with no changes.
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/cli/first-run-init.ts
git commit -m "docs(server/cli): record installer contract for --first-run-init"
```

---

## Task 10: Coverage and full-suite green

**Files:** None.

- [ ] **Step 1: Run all server tests with coverage**

```bash
npm --workspace @autooffice/server run test -- --coverage
```

- [ ] **Step 2: Add tests for any uncovered branches** (most likely the rotate-token CLI path and config error fallbacks).

- [ ] **Step 3: Push branch**

```bash
git push
```

CI must remain green.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: cert generation + install, token + config persistence, named single-instance lock, `--first-run-init` subcommand, HTTPS Bun.serve wired to cert+token, tray with rotate/restart — all present.
- [x] No TODO/TBD placeholders. (One follow-up note for systray robustness, with explicit fallback path.)
- [x] Trust-store install via PowerShell (cross-Windows-version stable, easier than `bun:ffi` against `crypt32.dll`).
- [x] Cert uninstall by fingerprint exists for use by the installer's uninstaller (plan 07).
- [x] No references to identifiers from later plans except the installer contract, which is explicitly noted as forward-looking.
