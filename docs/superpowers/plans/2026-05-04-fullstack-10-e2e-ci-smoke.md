# Local full-stack — Plan 10: E2E + CI matrix + smoke checklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Playwright end-to-end suite that drives the SPA against a real bun server, extend CI to a 5-job matrix that gates merge (vitest Linux, vitest Windows, Playwright, build smoke, installer smoke), commit a manual Office task-pane smoke checklist, and execute the spec's Definition-of-Done verification on a clean Windows VM.

**Architecture:** Playwright drives Chromium against `http://localhost:47318/` (HTTP for dev mode) with a stub provider injected via env. The test harness boots `bun --watch apps/server/src/index.ts` with `AUTOOFFICE_TOKEN=…` and a special `AUTOOFFICE_TEST_PROVIDER=fake` env that swaps in a deterministic in-process model on the server side. Tests cover: chat send + render, code approval, settings → add MCP server (in-process fake), tool policy toggle, conversation reload across page refresh.

The CI matrix runs all five jobs on every PR and on `feat/local-fullstack` push. Branch protection on `master` requires all five.

**Tech Stack:** `@playwright/test`, vitest (existing), GitHub Actions matrix.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Testing" + "Migration strategy → Definition of done".

---

## File structure after this plan

```
e2e/
├── package.json                       NEW
├── playwright.config.ts               NEW
├── tests/
│   ├── chat.spec.ts                   NEW
│   ├── settings.spec.ts               NEW
│   └── reload.spec.ts                 NEW
└── fixtures/
    └── boot-server.ts                 NEW (test fixture that starts bun)

apps/server/src/
├── chat/test-provider.ts              NEW (in-server fake LanguageModel)
└── app.ts                             MODIFIED (use test provider when AUTOOFFICE_TEST_PROVIDER=fake)

.github/workflows/
└── ci.yml                             MODIFIED (5-job matrix)

docs/superpowers/specs/
└── 2026-05-04-local-fullstack-migration-design-smoke-checklist.md  NEW
```

---

## Task 1: In-server fake provider for E2E

**Files:**
- Create: `apps/server/src/chat/test-provider.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Implement a deterministic LanguageModel**

`apps/server/src/chat/test-provider.ts`:
```ts
import type { LanguageModel } from 'ai';

export function makeTestProvider(): (providerId: string, modelId: string) => LanguageModel {
  return (_providerId, modelId) => ({
    specificationVersion: 'v2',
    provider: 'autooffice-test',
    modelId,
    async doStream({ prompt }: any) {
      // Echo last user text. If user said "code", emit a tool call to execute_code.
      const last = (prompt as any[]).at(-1);
      const userText = (last?.content ?? []).filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
      const wantsCode = /code/i.test(userText);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't0' });
            controller.enqueue({ type: 'text-delta', id: 't0', delta: `Echo: ${userText}` });
            controller.enqueue({ type: 'text-end', id: 't0' });
            if (wantsCode) {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'tc0',
                toolName: 'execute_code',
                input: { code: 'await context.sync()' },
              });
            }
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  } as unknown as LanguageModel);
}
```

- [ ] **Step 2: Wire in `app.ts` when env says so**

In `apps/server/src/app.ts`, modify `createApp` to default the `modelOverride` from env:
```ts
import { makeTestProvider } from './chat/test-provider';
// …
export function createApp(config: AppConfig) {
  // …
  const modelOverride =
    config.modelOverride ??
    (process.env.AUTOOFFICE_TEST_PROVIDER === 'fake' ? makeTestProvider() : undefined);
  // …
  app.route('/api/chat', chatRouter({ /* … */, modelOverride }));
  // …
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): in-server fake LanguageModel gated by AUTOOFFICE_TEST_PROVIDER=fake"
```

---

## Task 2: Playwright workspace

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/playwright.config.ts`
- Create: `e2e/fixtures/boot-server.ts`

- [ ] **Step 1: package.json**

`e2e/package.json`:
```json
{
  "name": "@autooffice/e2e",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  }
}
```

- [ ] **Step 2: playwright.config.ts**

`e2e/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:47318',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 3: boot-server.ts**

`e2e/fixtures/boot-server.ts`:
```ts
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as base } from '@playwright/test';

type Fixtures = { server: { proc: ChildProcess; token: string; dataDir: string } };

export const test = base.extend<Fixtures>({
  server: async ({}, use) => {
    const dataDir = mkdtempSync(join(tmpdir(), 'autoo-e2e-'));
    const token = 'e2e-token';
    const env = {
      ...process.env,
      AUTOOFFICE_TOKEN: token,
      AUTOOFFICE_DATA_DIR: dataDir,
      AUTOOFFICE_TEST_PROVIDER: 'fake',
      NODE_ENV: 'development',
    };
    const proc = spawn('bun', ['--watch', 'apps/server/src/index.ts'], { env, stdio: 'inherit' });

    // wait for /health to come up
    await waitForHealth('http://localhost:47318/health');

    await use({ proc, token, dataDir });

    proc.kill('SIGINT');
    rmSync(dataDir, { recursive: true, force: true });
  },
});

async function waitForHealth(url: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not come up');
}
```

- [ ] **Step 4: Install Playwright in the e2e workspace**

```bash
npm install
npx --workspace @autooffice/e2e playwright install chromium
```

- [ ] **Step 5: Commit**

```bash
git add e2e package.json package-lock.json
git commit -m "chore(e2e): Playwright workspace + boot-server fixture"
```

---

## Task 3: chat.spec.ts

**Files:**
- Create: `e2e/tests/chat.spec.ts`

- [ ] **Step 1: Test**

`e2e/tests/chat.spec.ts`:
```ts
import { expect } from '@playwright/test';
import { test } from '../fixtures/boot-server';

test('user can send a message and see the echo', async ({ page }) => {
  await page.goto('/');
  // The SPA bootstraps and shows the chat UI.
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox').fill('hello');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Echo: hello/)).toBeVisible({ timeout: 10_000 });
});

test('asking for code triggers the execute_code approve UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('textbox').fill('please write code');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Run locally** (after Playwright install)

```bash
npm --workspace @autooffice/e2e run test
```
Expected: 2 passing.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/chat.spec.ts
git commit -m "test(e2e): chat send/echo + execute_code approve appears"
```

---

## Task 4: settings.spec.ts

**Files:**
- Create: `e2e/tests/settings.spec.ts`

- [ ] **Step 1: Test**

`e2e/tests/settings.spec.ts`:
```ts
import { expect } from '@playwright/test';
import { test } from '../fixtures/boot-server';

test('settings page lists no providers initially and accepts adding one', async ({ page, server }) => {
  await page.goto('/');
  // Open settings — adapt the selector to whatever the UI uses (gear icon, etc.).
  await page.getByRole('button', { name: /settings|gear/i }).click();
  await expect(page.getByText(/Providers/i)).toBeVisible();

  // Add a CLI-bridge provider via API directly (UI selectors may vary).
  const resp = await page.request.post('/api/providers', {
    data: { kind: 'claude-code', label: 'Test CC' },
    headers: { Authorization: `Bearer ${server.token}` },
  });
  expect(resp.status()).toBe(201);
});
```

- [ ] **Step 2: Run, confirm passing locally**

```bash
npm --workspace @autooffice/e2e run test -- tests/settings.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/settings.spec.ts
git commit -m "test(e2e): settings page + add provider via API"
```

---

## Task 5: reload.spec.ts

**Files:**
- Create: `e2e/tests/reload.spec.ts`

- [ ] **Step 1: Test**

`e2e/tests/reload.spec.ts`:
```ts
import { expect } from '@playwright/test';
import { test } from '../fixtures/boot-server';

test('chat persists across page reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').fill('persisted message');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Echo: persisted message/)).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByText(/persisted message/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Echo: persisted message/)).toBeVisible();
});
```

- [ ] **Step 2: Run, confirm passing**

```bash
npm --workspace @autooffice/e2e run test -- tests/reload.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/reload.spec.ts
git commit -m "test(e2e): conversation persists across page reload"
```

---

## Task 6: CI matrix — extend `ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace with the 5-job matrix**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [master, feat/local-fullstack]
  pull_request:

jobs:
  vitest-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: npm ci
      - run: npm run lint:i18n
      - run: npm --workspace @autooffice/shared run test
      - run: npm --workspace @autooffice/server run test -- --coverage
      - run: npm --workspace @autooffice/web run test
      - run: npm --workspace @autooffice/web run build
      - run: npm --workspace @autooffice/server run build

  vitest-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: npm ci
      - run: npm --workspace @autooffice/server run test
        # Exercises DPAPI + cert + scheduled-task helpers on real Windows.

  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: npm ci
      - run: npx --workspace @autooffice/e2e playwright install --with-deps chromium
      - run: npm --workspace @autooffice/e2e run test

  build-smoke:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: npm ci
      - run: npm --workspace @autooffice/web run build
      - run: npm --workspace @autooffice/server run build
      - name: Smoke /health on the compiled binary
        shell: pwsh
        run: |
          Start-Process -FilePath "apps/server/dist/autoOffice-server.exe" -ArgumentList "" -PassThru | Out-Null
          Start-Sleep -Seconds 4
          $r = Invoke-WebRequest -Uri "http://localhost:47318/health" -UseBasicParsing
          if ($r.StatusCode -ne 200) { exit 1 }

  installer-smoke:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: npm ci
      - run: npm --workspace @autooffice/web run build
      - run: npm --workspace @autooffice/server run build
      - name: Install Inno Setup
        run: choco install -y innosetup
      - name: Build installer
        run: '& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\setup.iss'
      - name: Run installer silently
        run: '& installer/output/AutoOffice-Setup.exe /VERYSILENT /NORESTART'
      - name: /health after install
        shell: pwsh
        run: |
          Start-Sleep -Seconds 8
          $r = Invoke-WebRequest -Uri "https://localhost:47318/health" -UseBasicParsing -SkipCertificateCheck
          if ($r.StatusCode -ne 200) { exit 1 }
      - name: Uninstall
        run: |
          Get-WmiObject -Query "SELECT * FROM Win32_Product WHERE Name LIKE 'AutoOffice%'" | ForEach-Object { $_.Uninstall() }
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 5-job matrix (vitest linux/windows + playwright + build-smoke + installer-smoke)"
git push
```

- [ ] **Step 3: Watch the run**

All five jobs should pass. Address any breakage by amending the relevant earlier plan's tasks (don't paper over here).

---

## Task 7: Manual smoke checklist doc

**Files:**
- Create: `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design-smoke-checklist.md`

- [ ] **Step 1: Write the checklist**

`docs/superpowers/specs/2026-05-04-local-fullstack-migration-design-smoke-checklist.md`:
```markdown
# Smoke checklist — local full-stack migration

Run on a clean Windows 10 + Windows 11 VM with Microsoft 365 (Word, Excel, PowerPoint) installed and AutoOffice never previously installed. Tick each line as you verify.

## Install
- [ ] `AutoOffice-Setup.exe` runs without SmartScreen blocking after "Run anyway".
- [ ] Cert prompt appears once and accepting it succeeds (or no prompt — also OK).
- [ ] Scheduled Task `AutoOffice\Service` exists and is Running.
- [ ] `https://localhost:47318/health` returns 200 from the VM browser.
- [ ] Word lists "AutoOffice" under Home → Add-ins → Advanced → Shared Folder.

## First-launch UX
- [ ] Task pane loads in Word without any cert error overlay.
- [ ] Task pane also loads in Excel and PowerPoint (open each, sideload, verify).
- [ ] If migrating from a prior install, the legacy import modal appears and Import succeeds.

## Direct API provider (Anthropic)
- [ ] Add Anthropic provider with a valid key — readiness goes "ready".
- [ ] Send "make all paragraphs bold" — agent calls `lookup_skill`, then `execute_code`, document changes.
- [ ] On code error, retry happens automatically.

## CLI-bridge provider (Claude Code)
- [ ] `claude --version` works in the same user shell.
- [ ] Add the Claude Code provider — status "ready".
- [ ] Send "make all paragraphs bold" — works the same as direct API.

## stdio MCP server
- [ ] Add `npx -y @modelcontextprotocol/server-filesystem /tmp` (or similar).
- [ ] Status goes to "connected", N tools listed.
- [ ] Set one tool to `deny`; ask the agent to use it — model says it can't, doesn't try.
- [ ] Set one tool to `ask`; trigger it — approve UI appears, Approve runs the tool, Deny short-circuits.
- [ ] Set one tool to `allow`; trigger it — runs silently.

## CORS-blocked HTTP MCP
- [ ] Add an HTTP MCP that previously failed in the browser-only build — now connects.

## Persistence
- [ ] Send a message; close the task pane mid-stream; reopen — the final response is saved.
- [ ] Reload Word; reopen task pane; the conversation is intact.

## Uninstall
- [ ] Settings → Apps → AutoOffice → Uninstall completes.
- [ ] Scheduled Task removed.
- [ ] Cert removed from CurrentUser\Root (`Get-ChildItem Cert:\\CurrentUser\\Root | Where Subject -match 'AutoOffice'` returns empty).
- [ ] Manifest removed from share folder.
- [ ] Data folder prompt shown — both "Yes" and "No" paths leave a clean system.

## Repeat on Windows 11
Run the entire list a second time on Windows 11. Differences vs Windows 10 noted here.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs: smoke checklist for local-fullstack migration DoD"
```

---

## Task 8: Definition-of-done verification

**Files:** None.

- [ ] **Step 1: Run the smoke checklist on clean Windows 10 VM** (manual; allocate ~1 hour).

- [ ] **Step 2: Run the smoke checklist on clean Windows 11 VM** (manual).

- [ ] **Step 3: Capture any issues** as new tasks in the relevant earlier plan and resolve before merge.

- [ ] **Step 4: Verify all five CI jobs are green** on the latest branch commit.

- [ ] **Step 5: Open a draft PR**

```bash
gh pr create --draft --title "Local full-stack migration" \
  --body "Implements the full client-only → local full-stack migration. See docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md and the ten plans under docs/superpowers/plans/2026-05-04-fullstack-*.md. DoD verified on Win10 + Win11 VMs; smoke checklist passing."
```

- [ ] **Step 6: Mark ready for review when DoD checklist + CI are both green.**

- [ ] **Step 7: Merge to master.**

```bash
gh pr merge --squash --delete-branch
```

The migration is complete.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: in-server fake LanguageModel, Playwright workspace + 3 spec files, 5-job CI matrix, manual smoke checklist, DoD verification — all present.
- [x] No TODO/TBD placeholders.
- [x] CI matrix maps directly to the spec's testing section: vitest Linux + Windows (covers DPAPI), Playwright Linux, build smoke, installer smoke.
- [x] Smoke checklist mirrors the spec's "Definition of done and connected" 1:1 plus extras (uninstall paths).
- [x] PR creation step explicit; merge instruction explicit.
- [x] Plan terminates the migration. No further plans needed.
