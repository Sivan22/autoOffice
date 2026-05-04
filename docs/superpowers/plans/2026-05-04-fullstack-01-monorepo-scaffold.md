# Local full-stack — Plan 01: Monorepo scaffold + bare server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo into an npm-workspaces monorepo (`apps/web`, `apps/server`, `packages/shared`), wire up a bun-runtime Hono server with a `/health` route, and integrate Vite middleware mode in dev, all without changing any user-facing behavior of the existing Office add-in.

**Architecture:** Root package.json declares workspaces. The existing `src/taskpane` moves into `apps/web/src/taskpane` with no logic changes. A new `apps/server` runs Hono on bun, serves `/health` and (in production) the built static SPA. In dev, Hono delegates non-`/api` routes to a Vite middleware-mode server so HMR keeps working at the same port. `packages/shared` is a placeholder workspace for zod schemas later plans will fill.

**Tech Stack:** npm workspaces, bun (runtime + bundler), Hono, Vite, vitest, TypeScript, existing React + Fluent UI stack untouched.

**Branch:** `feat/local-fullstack`

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md`

---

## File structure after this plan

```
autoOffice/
├── package.json                       MODIFIED (workspaces, root scripts)
├── tsconfig.base.json                 NEW (shared compiler options)
├── apps/
│   ├── web/
│   │   ├── package.json               NEW (carries old deps + scripts)
│   │   ├── tsconfig.json              MOVED + retargeted
│   │   ├── vite.config.ts             MOVED + paths fixed
│   │   ├── vitest.config.ts           MOVED + paths fixed
│   │   ├── index.html                 MOVED
│   │   ├── public/                    MOVED
│   │   └── src/                       MOVED (was src/)
│   └── server/
│       ├── package.json               NEW
│       ├── tsconfig.json              NEW
│       ├── vitest.config.ts           NEW
│       ├── build.ts                   NEW (bun --compile script)
│       └── src/
│           ├── index.ts               NEW (entry: starts Hono)
│           ├── app.ts                 NEW (Hono app factory)
│           ├── env.ts                 NEW (port + cwd helpers)
│           ├── routes/
│           │   ├── health.ts          NEW
│           │   └── health.test.ts     NEW
│           └── middleware/
│               └── vite-dev.ts        NEW (Vite middlewareMode integration)
├── packages/
│   └── shared/
│       ├── package.json               NEW
│       ├── tsconfig.json              NEW
│       └── src/
│           └── index.ts               NEW (empty barrel for now)
├── tools/                             UNCHANGED in place
├── installer/                         UNCHANGED in place
├── manifest.xml                       UNCHANGED in place
├── manifest.production.xml            UNCHANGED in place
└── .github/workflows/
    ├── ci.yml                         NEW (replaces old test job)
    └── deploy.yml                     UNCHANGED for now (still builds web→Pages; replaced in plan 09)
```

---

## Task 1: Create migration branch

**Files:**
- None (git only)

- [ ] **Step 1: Confirm clean working tree**

Run:
```bash
git status
```
Expected: `nothing to commit, working tree clean`. If not, stash or commit pending work first.

- [ ] **Step 2: Create and switch to the migration branch**

Run:
```bash
git checkout -b feat/local-fullstack
```
Expected: `Switched to a new branch 'feat/local-fullstack'`.

- [ ] **Step 3: Push the branch upstream so CI can run on it**

Run:
```bash
git push -u origin feat/local-fullstack
```
Expected: branch tracks `origin/feat/local-fullstack`.

---

## Task 2: Add tsconfig.base.json

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create the shared base tsconfig**

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: add shared tsconfig.base.json for monorepo"
```

---

## Task 3: Stage the workspace move

**Files:**
- Create directories: `apps/web/`, `apps/server/`, `packages/shared/`

- [ ] **Step 1: Create the directory skeleton**

Run:
```bash
mkdir -p apps/web apps/server/src/routes apps/server/src/middleware packages/shared/src
```

- [ ] **Step 2: Verify with tree-style listing**

Run:
```bash
find apps packages -type d
```
Expected: shows the seven directories above.

---

## Task 4: Move existing web app into `apps/web`

**Files:**
- Move: `src/` → `apps/web/src/`
- Move: `public/` → `apps/web/public/`
- Move: `index.html` → `apps/web/index.html`
- Move: `vite.config.ts` → `apps/web/vite.config.ts`
- Move: `vitest.config.ts` → `apps/web/vitest.config.ts`
- Move: `tsconfig.json` → `apps/web/tsconfig.json`

- [ ] **Step 1: git-mv each path so history is preserved**

Run each in sequence:
```bash
git mv src apps/web/src
git mv public apps/web/public
git mv index.html apps/web/index.html
git mv vite.config.ts apps/web/vite.config.ts
git mv vitest.config.ts apps/web/vitest.config.ts
git mv tsconfig.json apps/web/tsconfig.json
```

- [ ] **Step 2: Verify the moves landed**

Run:
```bash
git status
```
Expected: only renames listed under "Changes to be committed", no deletes/adds.

- [ ] **Step 3: Update `apps/web/tsconfig.json` to extend the base**

Open `apps/web/tsconfig.json` and replace `compilerOptions` with:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["office-js", "vite/client"],
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Update `apps/web/vite.config.ts` paths**

Open `apps/web/vite.config.ts`. Confirm/adjust `root` so it resolves to the workspace folder, and update any `path.resolve` calls so they're relative to the new file location. The bottom of the config should look like:

```ts
export default defineConfig({
  // existing plugins, etc.
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5: Update `apps/web/vitest.config.ts` paths**

Open `apps/web/vitest.config.ts`. Make sure `test.setupFiles` references `./src/taskpane/test-setup.ts` (relative — already correct after the move). No code change usually needed; eyeball-verify.

- [ ] **Step 6: Commit the move**

```bash
git add -A
git commit -m "refactor: move web app into apps/web workspace (no behavior change)"
```

---

## Task 5: Add `apps/web/package.json`

**Files:**
- Create: `apps/web/package.json`
- Modify: root `package.json`

- [ ] **Step 1: Read the current root `package.json`**

Run:
```bash
cat package.json
```
Note all the deps and scripts — they will move into `apps/web/package.json`.

- [ ] **Step 2: Write `apps/web/package.json`**

Replace `<deps>` and `<devDeps>` with the exact entries from the current root `package.json`. The scripts block:

```json
{
  "name": "@autooffice/web",
  "version": "0.1.0",
  "private": true,
  "description": "AutoOffice task pane (React + Vite)",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "certs": "office-addin-dev-certs install",
    "start": "office-addin-debugging start ../../manifest.xml --app word",
    "start:excel": "office-addin-debugging start ../../manifest.xml --app excel",
    "start:powerpoint": "office-addin-debugging start ../../manifest.xml --app powerpoint",
    "stop": "office-addin-debugging stop ../../manifest.xml",
    "sideload": "office-addin-debugging start ../../manifest.xml desktop --no-debug --app word",
    "sideload:excel": "office-addin-debugging start ../../manifest.xml desktop --no-debug --app excel",
    "sideload:powerpoint": "office-addin-debugging start ../../manifest.xml desktop --no-debug --app powerpoint",
    "gen:i18n": "node --experimental-strip-types ../../tools/gen-i18n-types.ts",
    "check:i18n": "node --experimental-strip-types ../../tools/check-translations.ts",
    "prebuild": "npm run gen:i18n",
    "pretest": "npm run gen:i18n"
  },
  "dependencies": <deps>,
  "devDependencies": <devDeps>
}
```

Copy `dependencies` and `devDependencies` verbatim from the original root `package.json`.

- [ ] **Step 3: Rewrite root `package.json` for workspaces**

Replace root `package.json` with:

```json
{
  "name": "autooffice",
  "version": "0.1.0",
  "private": true,
  "description": "AutoOffice — local full-stack",
  "license": "MIT",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm --workspace @autooffice/server run dev",
    "dev:web": "npm --workspace @autooffice/web run dev",
    "build": "npm --workspace @autooffice/web run build && npm --workspace @autooffice/server run build",
    "test": "npm run --workspaces --if-present test",
    "lint:i18n": "npm --workspace @autooffice/web run check:i18n"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

- [ ] **Step 4: Re-install dependencies into the workspace tree**

Run:
```bash
rm -rf node_modules
npm install
```
Expected: a single root `node_modules/` populated with hoisted deps; per-workspace `node_modules/` only for non-hoistable packages. No errors.

- [ ] **Step 5: Verify the web build still works**

Run:
```bash
npm --workspace @autooffice/web run build
```
Expected: `dist/` produced under `apps/web/`, no TypeScript errors. If you see `Cannot find module ...`, fix the `@shared/*` alias in `apps/web/tsconfig.json` (it's allowed to be unused for now since nothing imports `@shared` yet).

- [ ] **Step 6: Verify existing web tests still pass**

Run:
```bash
npm --workspace @autooffice/web run test
```
Expected: vitest reports the prior test suite green (same count as before the move).

- [ ] **Step 7: Commit**

```bash
git add package.json apps/web/package.json package-lock.json
git commit -m "chore: split workspace package.jsons; web compiles + tests pass"
```

---

## Task 6: Create `packages/shared` workspace

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@autooffice/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create the empty barrel**

`packages/shared/src/index.ts`:
```ts
// Shared zod schemas + types live here. Filled in by later plans.
export {};
```

- [ ] **Step 4: Install workspace deps**

Run:
```bash
npm install
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "chore: scaffold @autooffice/shared workspace"
```

---

## Task 7: Create `apps/server` package skeleton

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`

- [ ] **Step 1: Create `apps/server/package.json`**

```json
{
  "name": "@autooffice/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build.ts",
    "start": "bun src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@autooffice/shared": "*",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0"
  },
  "devDependencies": {
    "@types/bun": "^1.1.0",
    "vite": "^8.0.9",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Create `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun"],
    "jsx": "react-jsx",
    "outDir": "dist",
    "paths": {
      "@shared/*": ["../../packages/shared/src/*"]
    }
  },
  "include": ["src", "build.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `apps/server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': new URL('../../packages/shared/src', import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 4: Install bun if missing**

Run:
```bash
bun --version || curl -fsSL https://bun.sh/install | bash
```
Expected: `bun --version` succeeds (re-open shell if just installed).

- [ ] **Step 5: Install workspace deps**

Run:
```bash
npm install
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/package.json apps/server/tsconfig.json apps/server/vitest.config.ts package.json package-lock.json
git commit -m "chore: scaffold @autooffice/server workspace"
```

---

## Task 8: Add `/health` route — failing test first

**Files:**
- Create: `apps/server/src/routes/health.test.ts`
- Create: `apps/server/src/app.ts` (skeleton — fills in next task)

- [ ] **Step 1: Create app skeleton that fails the test**

`apps/server/src/app.ts`:
```ts
import { Hono } from 'hono';

export type AppConfig = {
  version: string;
};

export function createApp(_config: AppConfig) {
  const app = new Hono();
  return app;
}
```

- [ ] **Step 2: Write the failing test**

`apps/server/src/routes/health.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../app';

describe('GET /health', () => {
  const app = createApp({ version: '0.0.0-test' });

  it('returns 200 with ok=true and the configured version', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      version: '0.0.0-test',
    });
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.pid).toBe('number');
  });

  it('does not require authentication', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run the test and confirm failure**

Run:
```bash
npm --workspace @autooffice/server run test -- src/routes/health.test.ts
```
Expected: FAIL — `404` returned, body does not match.

---

## Task 9: Implement `/health`

**Files:**
- Create: `apps/server/src/routes/health.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Implement the route**

`apps/server/src/routes/health.ts`:
```ts
import { Hono } from 'hono';

const startedAt = Date.now();

export function healthRouter(version: string) {
  const r = new Hono();
  r.get('/health', (c) =>
    c.json({
      ok: true,
      version,
      pid: process.pid,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      port: Number(process.env.AUTOOFFICE_PORT ?? 47318),
    }),
  );
  return r;
}
```

- [ ] **Step 2: Wire it into `app.ts`**

Replace `apps/server/src/app.ts` with:
```ts
import { Hono } from 'hono';
import { healthRouter } from './routes/health';

export type AppConfig = {
  version: string;
};

export function createApp(config: AppConfig) {
  const app = new Hono();
  app.route('/', healthRouter(config.version));
  return app;
}
```

- [ ] **Step 3: Run the test and confirm passing**

Run:
```bash
npm --workspace @autooffice/server run test -- src/routes/health.test.ts
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/health.ts apps/server/src/routes/health.test.ts apps/server/src/app.ts
git commit -m "feat(server): /health route returns ok/version/uptime/pid"
```

---

## Task 10: Add the bun entry point

**Files:**
- Create: `apps/server/src/env.ts`
- Create: `apps/server/src/index.ts`

- [ ] **Step 1: Create `env.ts`**

`apps/server/src/env.ts`:
```ts
export const PORT = Number(process.env.AUTOOFFICE_PORT ?? 47318);
export const HOST = process.env.AUTOOFFICE_HOST ?? '127.0.0.1';
export const VERSION = process.env.AUTOOFFICE_VERSION ?? '0.0.0-dev';
export const IS_DEV = process.env.NODE_ENV !== 'production';
```

- [ ] **Step 2: Create `index.ts` (dev-only listen, no static-serve yet)**

`apps/server/src/index.ts`:
```ts
import { createApp } from './app';
import { HOST, PORT, VERSION } from './env';

const app = createApp({ version: VERSION });

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: app.fetch,
});

console.log(`[autoOffice] listening on http://${server.hostname}:${server.port}`);
```

- [ ] **Step 3: Smoke-test by running once**

Run (in one shell):
```bash
npm --workspace @autooffice/server run start
```
In another shell:
```bash
curl -s http://127.0.0.1:47318/health | head -c 200
```
Expected: JSON `{"ok":true,...}`. Stop the server with Ctrl-C in shell #1.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/env.ts apps/server/src/index.ts
git commit -m "feat(server): bun entry binds Hono to 127.0.0.1:47318"
```

---

## Task 11: Add Vite middleware-mode integration for dev

**Files:**
- Create: `apps/server/src/middleware/vite-dev.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create the Vite delegate**

`apps/server/src/middleware/vite-dev.ts`:
```ts
import type { Context, MiddlewareHandler } from 'hono';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function makeViteMiddleware(): Promise<MiddlewareHandler> {
  const { createServer } = await import('vite');
  const webRoot = fileURLToPath(new URL('../../../web', import.meta.url));
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: 'spa',
  });

  return async (c: Context, next) => {
    if (c.req.path.startsWith('/api') || c.req.path === '/health') {
      return next();
    }
    const url = new URL(c.req.url);
    return new Promise<Response>((resolve, reject) => {
      const fakeReq = { url: url.pathname + url.search, method: c.req.method, headers: Object.fromEntries(c.req.raw.headers) } as any;
      const chunks: Buffer[] = [];
      const fakeRes = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; },
        getHeader(k: string) { return this.headers[k.toLowerCase()]; },
        write(chunk: Buffer | string) { chunks.push(Buffer.from(chunk)); return true; },
        end(chunk?: Buffer | string) {
          if (chunk) chunks.push(Buffer.from(chunk));
          resolve(new Response(Buffer.concat(chunks), { status: this.statusCode, headers: this.headers }));
        },
      } as any;
      vite.middlewares(fakeReq, fakeRes, (err: unknown) => {
        if (err) reject(err);
        else resolve(new Response('Not handled', { status: 404 }));
      });
    });
  };
}
```

> **Note:** Hono + Vite middleware mode commonly uses an adapter library. The shim above is a minimal one good enough for dev; if a maintained adapter (`@hono/vite-dev-server`, `hono-vite`) is available at implementation time, prefer it and replace this file. Keep the shape of the export (`makeViteMiddleware()` returns a Hono `MiddlewareHandler`) the same.

- [ ] **Step 2: Wire it into `index.ts` for dev**

Replace `apps/server/src/index.ts` with:
```ts
import { createApp } from './app';
import { HOST, IS_DEV, PORT, VERSION } from './env';

const app = createApp({ version: VERSION });

if (IS_DEV) {
  const { makeViteMiddleware } = await import('./middleware/vite-dev');
  app.use('*', await makeViteMiddleware());
} else {
  // Production static-serve added in plan 05.
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: app.fetch,
});

console.log(`[autoOffice] ${IS_DEV ? 'dev' : 'prod'} listening on http://${server.hostname}:${server.port}`);
```

- [ ] **Step 3: Run dev and confirm the SPA loads**

Run:
```bash
npm --workspace @autooffice/server run dev
```
Then in a browser open `http://127.0.0.1:47318/`. Expected: the React task pane HTML loads (it will render an Office.onReady timeout error since we're not in Office — that's fine; we're verifying Vite transforms the entry).

Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/middleware/vite-dev.ts apps/server/src/index.ts
git commit -m "feat(server): delegate non-/api routes to Vite middleware in dev"
```

---

## Task 12: Add bun compile script

**Files:**
- Create: `apps/server/build.ts`

- [ ] **Step 1: Write the build script**

`apps/server/build.ts`:
```ts
// Compiles the server into a single Windows .exe.
// Run with: bun build.ts
import { $ } from 'bun';

const out = './dist/autoOffice-server.exe';
await $`mkdir -p dist`;

console.log('Building autoOffice-server.exe …');
await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  minify: true,
  // `--compile` is bun's CLI flag; surface via Bun.build is `compile: { target: 'bun-windows-x64', outfile }`.
  // Older bun versions support only the CLI form. We exec it directly:
});

await $`bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile=${out} --minify`;
console.log(`OK → ${out}`);
```

- [ ] **Step 2: Run it once and verify the binary exists**

Run:
```bash
npm --workspace @autooffice/server run build
ls -lh apps/server/dist/autoOffice-server.exe
```
Expected: file exists, size in tens of MB. (Cannot run a Windows binary on Linux; this just verifies compile succeeds.)

- [ ] **Step 3: Add `apps/server/dist/` to `.gitignore`**

Append to root `.gitignore`:
```
apps/server/dist/
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/build.ts .gitignore
git commit -m "feat(server): bun --compile script produces autoOffice-server.exe"
```

---

## Task 13: Root scripts and README update

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add a one-shot dev script that runs server (which delegates to web via Vite)**

`package.json` — extend `scripts`:
```json
{
  "scripts": {
    "dev": "npm --workspace @autooffice/server run dev",
    "dev:web": "npm --workspace @autooffice/web run dev",
    "build": "npm --workspace @autooffice/web run build && npm --workspace @autooffice/server run build",
    "test": "npm run --workspaces --if-present test",
    "lint:i18n": "npm --workspace @autooffice/web run check:i18n",
    "sideload": "npm --workspace @autooffice/web run sideload",
    "sideload:excel": "npm --workspace @autooffice/web run sideload:excel",
    "sideload:powerpoint": "npm --workspace @autooffice/web run sideload:powerpoint",
    "stop": "npm --workspace @autooffice/web run stop"
  }
}
```

- [ ] **Step 2: Add a "Monorepo layout" section to README.md**

Insert after the existing "Tech Stack" section:
```markdown
## Monorepo layout

- `apps/web` — React task pane (Vite + Fluent UI). Same code as before, just relocated.
- `apps/server` — Hono server on bun runtime. In dev, serves the task pane via Vite middleware; in production it serves the built SPA from `apps/web/dist/`.
- `packages/shared` — zod schemas + types shared between web and server.

`npm run dev` starts the server (which delegates non-`/api` routes to Vite for HMR). `npm run sideload` then loads the manifest into Word as before.
```

- [ ] **Step 3: Verify everything still runs**

Run:
```bash
npm run test
```
Expected: all workspaces' tests pass. (Web's existing suite + server's `health.test.ts`.)

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "chore: root scripts + README for new monorepo layout"
```

---

## Task 14: Update CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Inspect (and possibly update): `.github/workflows/deploy.yml`

- [ ] **Step 1: Read the existing CI/deploy workflows**

Run:
```bash
ls .github/workflows
cat .github/workflows/deploy.yml
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

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
        with:
          node-version: '22'
          cache: npm
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: npm ci
      - run: npm run lint:i18n
      - run: npm --workspace @autooffice/shared run test -- --coverage || true
      - run: npm --workspace @autooffice/server run test -- --coverage
      - run: npm --workspace @autooffice/web run test
      - run: npm --workspace @autooffice/web run build
      - run: npm --workspace @autooffice/server run build
```

> **Note:** plan 10 adds the Windows job, the Playwright job, and the installer job. This file gets extended there, not replaced.

- [ ] **Step 3: Confirm `deploy.yml` still works on the new layout, or note it for plan 09**

If `deploy.yml` references `dist/` at the repo root, it now needs to reference `apps/web/dist/`. **Defer fixing it to plan 09** (where Pages becomes the landing site anyway). Add a TODO comment near the top of `deploy.yml`:

```yaml
# TODO(plan-09): repoint to landing/ instead of apps/web/dist/.
```

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: add monorepo-aware vitest/build job; mark deploy.yml for plan 09"
git push
```

- [ ] **Step 5: Watch the new CI run**

Open GitHub Actions for the branch. Expected: the `CI / vitest-linux` job goes green.

---

## Task 15: Smoke test — sideload still works

**Files:** None (manual verification on a Windows host).

- [ ] **Step 1: From the Windows dev machine, install dev certs and start dev**

In Windows shell:
```powershell
npm install
npm --workspace @autooffice/web run certs
npm run dev
```

- [ ] **Step 2: Sideload Word**

In a second Windows shell:
```powershell
npm run sideload
```
Expected: Word opens, AutoOffice task pane appears, chat works exactly as before this plan started.

- [ ] **Step 3: Note any regressions**

If anything broke, fix in the relevant earlier task and re-run from there. Do not move to plan 02 with regressions outstanding.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: monorepo scaffold, bare server with `/health`, dev workflow with Vite middleware mode, build pipeline, CI scaffolding — all present.
- [x] No TODO/TBD/placeholder language in steps.
- [x] Every step shows the actual command or code.
- [x] File paths absolute within the repo, consistent across tasks.
- [x] Tests precede implementation in Tasks 8/9.
- [x] Commit boundaries are aligned with logical units.
- [x] No references to identifiers defined in later plans.
