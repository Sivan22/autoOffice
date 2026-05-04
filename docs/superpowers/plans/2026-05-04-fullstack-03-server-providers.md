# Local full-stack — Plan 03: Server-side providers (incl. CLI bridges)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all AI providers from the browser to the server, register them through a `ProviderRegistry` driven by SQLite-stored configs (with DPAPI-wrapped keys), and add the new CLI-bridge providers (Claude Code, Gemini CLI, OpenCode) that were blocked in the browser. Expose `/api/providers` for the frontend to manage configs and run readiness probes.

**Architecture:** A provider config is `{ kind, label, config, encrypted_key }`. The `ProviderRegistry` resolves each kind through a factory that returns a Vercel AI SDK `LanguageModel`. CLI-bridge providers (`claude-code`, `gemini-cli`, `opencode`) wrap the user's installed CLI and have no API key — instead they have a *readiness probe* that runs the CLI's `--version` and checks for known auth-failure markers. The repo encrypts keys at write-time via the DPAPI wrapper from plan 02 (no-op fallback elsewhere with explicit warning).

**Tech Stack:** AI SDK provider packages (already deps in current project, kept and re-exported server-side), `ai-sdk-provider-claude-code`, `ai-sdk-provider-gemini-cli`, `ai-sdk-provider-opencode-sdk`, `bun:ffi` for spawn-based readiness probes, zod, vitest.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Providers (server-side)".

---

## File structure after this plan

```
apps/server/
├── package.json                        MODIFIED (add CLI-bridge SDKs)
├── src/
│   ├── app.ts                          MODIFIED (mount /api/providers)
│   ├── db/
│   │   ├── providers.ts                NEW (ProvidersRepo)
│   │   └── providers.test.ts           NEW
│   ├── providers/
│   │   ├── index.ts                    NEW (registry)
│   │   ├── index.test.ts               NEW
│   │   ├── factories/
│   │   │   ├── anthropic.ts            NEW
│   │   │   ├── openai.ts               NEW
│   │   │   ├── google.ts               NEW
│   │   │   ├── groq.ts                 NEW
│   │   │   ├── xai.ts                  NEW
│   │   │   ├── deepseek.ts             NEW
│   │   │   ├── openrouter.ts           NEW
│   │   │   ├── ollama.ts               NEW
│   │   │   ├── openai-compatible.ts    NEW
│   │   │   ├── vercel-gateway.ts       NEW
│   │   │   ├── claude-code.ts          NEW
│   │   │   ├── gemini-cli.ts           NEW
│   │   │   └── opencode.ts             NEW
│   │   ├── readiness.ts                NEW (CLI probes)
│   │   └── readiness.test.ts           NEW
│   └── routes/
│       ├── providers.ts                NEW
│       └── providers.test.ts           NEW

packages/shared/src/schemas/
├── provider.ts                         NEW (ProviderKind, ProviderConfigSchema)
└── index.ts                            MODIFIED (re-export)
```

---

## Task 1: Provider schema in `@autooffice/shared`

**Files:**
- Create: `packages/shared/src/schemas/provider.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Write the schema**

`packages/shared/src/schemas/provider.ts`:
```ts
import { z } from 'zod';

export const ProviderKindSchema = z.enum([
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'deepseek',
  'openrouter',
  'ollama',
  'openai-compatible',
  'vercel-gateway',
  'claude-code',
  'gemini-cli',
  'opencode',
]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const CLI_BRIDGE_KINDS: ReadonlyArray<ProviderKind> = ['claude-code', 'gemini-cli', 'opencode'];

export function isCliBridge(kind: ProviderKind): boolean {
  return CLI_BRIDGE_KINDS.includes(kind);
}

export const ProviderConfigSchema = z.object({
  id: z.string(),
  kind: ProviderKindSchema,
  label: z.string().min(1).max(80),
  config: z.record(z.string(), z.unknown()).default({}),  // baseUrl, model defaults, etc.
  hasKey: z.boolean(),                                     // server hides ciphertext from clients
  status: z.enum(['ready', 'needs-key', 'cli-not-found', 'cli-not-authed', 'unknown']).default('unknown'),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const CreateProviderInputSchema = z.object({
  kind: ProviderKindSchema,
  label: z.string().min(1).max(80),
  config: z.record(z.string(), z.unknown()).optional(),
  apiKey: z.string().min(1).optional(),                    // omitted for CLI bridges
});
export type CreateProviderInput = z.infer<typeof CreateProviderInputSchema>;

export const UpdateProviderInputSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  apiKey: z.string().min(1).optional(),                    // setting null/undefined keeps existing key
});
export type UpdateProviderInput = z.infer<typeof UpdateProviderInputSchema>;
```

- [ ] **Step 2: Re-export**

Edit `packages/shared/src/schemas/index.ts`:
```ts
export * from './settings';
export * from './conversation';
export * from './provider';
```

- [ ] **Step 3: Add a focused test**

`packages/shared/src/schemas/provider.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isCliBridge, ProviderKindSchema, ProviderConfigSchema, CreateProviderInputSchema } from './provider';

describe('ProviderKindSchema', () => {
  it('accepts known kinds', () => {
    expect(ProviderKindSchema.parse('anthropic')).toBe('anthropic');
    expect(ProviderKindSchema.parse('claude-code')).toBe('claude-code');
  });

  it('rejects unknown kinds', () => {
    expect(() => ProviderKindSchema.parse('cohere')).toThrow();
  });

  it('isCliBridge identifies CLI kinds', () => {
    expect(isCliBridge('claude-code')).toBe(true);
    expect(isCliBridge('anthropic')).toBe(false);
  });
});

describe('CreateProviderInputSchema', () => {
  it('allows missing apiKey for CLI bridges', () => {
    const r = CreateProviderInputSchema.parse({ kind: 'claude-code', label: 'My Claude Code' });
    expect(r.kind).toBe('claude-code');
  });
});

describe('ProviderConfigSchema', () => {
  it('round-trips a sample row', () => {
    const sample = {
      id: 'p_1',
      kind: 'anthropic' as const,
      label: 'Anthropic Default',
      config: { baseUrl: 'https://api.anthropic.com' },
      hasKey: true,
      status: 'ready' as const,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(ProviderConfigSchema.parse(sample)).toEqual(sample);
  });
});
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/shared run test
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): provider schemas + CLI-bridge identification"
```

---

## Task 2: Server deps for CLI bridges

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add the AI SDK packages and CLI bridges**

Edit `apps/server/package.json` `dependencies` (merge with existing):
```json
{
  "ai": "^6.0.168",
  "@ai-sdk/anthropic": "^3.0.71",
  "@ai-sdk/deepseek": "^2.0.29",
  "@ai-sdk/gateway": "^3.0.104",
  "@ai-sdk/google": "^3.0.64",
  "@ai-sdk/groq": "^3.0.35",
  "@ai-sdk/openai": "^3.0.53",
  "@ai-sdk/openai-compatible": "^2.0.41",
  "@ai-sdk/xai": "^3.0.83",
  "@openrouter/ai-sdk-provider": "^2.9.0",
  "ollama-ai-provider-v2": "^3.5.0",
  "ai-sdk-provider-claude-code": "^1.4.0",
  "ai-sdk-provider-gemini-cli": "^1.4.0",
  "ai-sdk-provider-opencode-sdk": "^1.0.0"
}
```

> **Note:** if any CLI-bridge package version doesn't resolve, use whichever stable major it's currently at. Prefer the maintained ones (`ben-vargas/ai-sdk-provider-claude-code`, `google-gemini/gemini-cli` adapters as published on npm).

- [ ] **Step 2: Install**

```bash
npm install
```
Expected: success (some packages may print peer-dep warnings — that's fine).

- [ ] **Step 3: Commit**

```bash
git add apps/server/package.json package-lock.json
git commit -m "chore(server): add AI SDK + CLI-bridge provider packages"
```

---

## Task 3: ProvidersRepo

**Files:**
- Create: `apps/server/src/db/providers.test.ts`
- Create: `apps/server/src/db/providers.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/db/providers.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { ProvidersRepo } from './providers';

const isWin = process.platform === 'win32';

describe('ProvidersRepo', () => {
  let repo: ProvidersRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new ProvidersRepo(db);
  });

  it('creates a provider without a key (CLI bridge)', () => {
    const id = repo.create({ kind: 'claude-code', label: 'My Claude Code' });
    const got = repo.get(id);
    expect(got).toMatchObject({ kind: 'claude-code', label: 'My Claude Code', hasKey: false });
  });

  it.runIf(isWin)('encrypts API keys via DPAPI on Windows', () => {
    const id = repo.create({ kind: 'anthropic', label: 'Anthropic', apiKey: 'sk-test' });
    expect(repo.get(id)!.hasKey).toBe(true);
    expect(repo.getDecryptedKey(id)).toBe('sk-test');
  });

  it.skipIf(isWin)('refuses to store an apiKey on non-Windows (DPAPI unavailable)', () => {
    expect(() => repo.create({ kind: 'anthropic', label: 'Anthropic', apiKey: 'sk-test' })).toThrow(/Windows/);
  });

  it('list returns all providers', () => {
    repo.create({ kind: 'claude-code', label: 'A' });
    repo.create({ kind: 'gemini-cli', label: 'B' });
    expect(repo.list()).toHaveLength(2);
  });

  it('update changes label and config without touching the key', () => {
    const id = repo.create({ kind: 'claude-code', label: 'Old' });
    repo.update(id, { label: 'New', config: { defaultModel: 'sonnet' } });
    const got = repo.get(id)!;
    expect(got.label).toBe('New');
    expect(got.config).toEqual({ defaultModel: 'sonnet' });
  });

  it('delete removes the row', () => {
    const id = repo.create({ kind: 'claude-code', label: 'X' });
    repo.delete(id);
    expect(repo.get(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/db/providers.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/db/providers.ts`:
```ts
import type { Database } from 'bun:sqlite';
import {
  CreateProviderInputSchema,
  type CreateProviderInput,
  type UpdateProviderInput,
  type ProviderConfig,
  ProviderConfigSchema,
  isCliBridge,
  newId,
} from '@autooffice/shared';
import { isDpapiAvailable, wrapSecret, unwrapSecret } from '../secrets/dpapi';

type Row = {
  id: string;
  kind: string;
  label: string;
  config: string;
  encrypted_key: Uint8Array | null;
  created_at: number;
  updated_at: number;
};

export class ProvidersRepo {
  constructor(private readonly db: Database) {}

  create(input: CreateProviderInput): string {
    const parsed = CreateProviderInputSchema.parse(input);
    const id = newId('p');
    const now = Date.now();
    let encrypted: Uint8Array | null = null;
    if (parsed.apiKey != null) {
      if (isCliBridge(parsed.kind)) {
        throw new Error(`Provider kind '${parsed.kind}' does not accept an API key`);
      }
      if (!isDpapiAvailable()) {
        throw new Error('Storing an API key requires Windows (DPAPI). Use a CLI bridge or run on Windows.');
      }
      encrypted = wrapSecret(parsed.apiKey);
    }
    this.db
      .prepare(
        `INSERT INTO provider_configs (id, kind, label, config, encrypted_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, parsed.kind, parsed.label, JSON.stringify(parsed.config ?? {}), encrypted, now, now);
    return id;
  }

  update(id: string, input: UpdateProviderInput): void {
    const cur = this.getRow(id);
    if (!cur) throw new Error('not found');
    const label = input.label ?? cur.label;
    const config = input.config != null ? JSON.stringify(input.config) : cur.config;
    let encrypted = cur.encrypted_key;
    if (input.apiKey != null) {
      if (!isDpapiAvailable()) {
        throw new Error('Storing an API key requires Windows (DPAPI).');
      }
      encrypted = wrapSecret(input.apiKey);
    }
    this.db
      .prepare(
        `UPDATE provider_configs SET label=?, config=?, encrypted_key=?, updated_at=? WHERE id=?`,
      )
      .run(label, config, encrypted, Date.now(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM provider_configs WHERE id = ?').run(id);
  }

  get(id: string): ProviderConfig | null {
    const row = this.getRow(id);
    if (!row) return null;
    return this.toView(row);
  }

  list(): ProviderConfig[] {
    const rows = this.db
      .query<Row, []>(
        'SELECT id, kind, label, config, encrypted_key, created_at, updated_at FROM provider_configs ORDER BY created_at ASC',
      )
      .all();
    return rows.map((r) => this.toView(r));
  }

  getDecryptedKey(id: string): string | null {
    const row = this.getRow(id);
    if (!row?.encrypted_key) return null;
    return unwrapSecret(row.encrypted_key);
  }

  private getRow(id: string): Row | null {
    return (
      this.db
        .query<Row, [string]>(
          'SELECT id, kind, label, config, encrypted_key, created_at, updated_at FROM provider_configs WHERE id = ?',
        )
        .get(id) ?? null
    );
  }

  private toView(row: Row): ProviderConfig {
    return ProviderConfigSchema.parse({
      id: row.id,
      kind: row.kind,
      label: row.label,
      config: JSON.parse(row.config),
      hasKey: row.encrypted_key != null,
      status: 'unknown',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/db/providers.test.ts
```
Expected on Linux: 4 passing (Windows-only test skipped). On Windows: all 6 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/providers.ts apps/server/src/db/providers.test.ts
git commit -m "feat(server/db): ProvidersRepo with DPAPI-encrypted keys"
```

---

## Task 4: Provider factories — direct API

**Files:**
- Create: `apps/server/src/providers/factories/anthropic.ts`
- Create: `apps/server/src/providers/factories/openai.ts`
- Create: `apps/server/src/providers/factories/google.ts`
- Create: `apps/server/src/providers/factories/groq.ts`
- Create: `apps/server/src/providers/factories/xai.ts`
- Create: `apps/server/src/providers/factories/deepseek.ts`
- Create: `apps/server/src/providers/factories/openrouter.ts`
- Create: `apps/server/src/providers/factories/ollama.ts`
- Create: `apps/server/src/providers/factories/openai-compatible.ts`
- Create: `apps/server/src/providers/factories/vercel-gateway.ts`

- [ ] **Step 1: Write the Anthropic factory**

`apps/server/src/providers/factories/anthropic.ts`:
```ts
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

export function makeAnthropic(opts: { apiKey: string; baseURL?: string }): (modelId: string) => LanguageModel {
  const provider = createAnthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  return (modelId) => provider(modelId);
}
```

- [ ] **Step 2: Write the rest in the same shape**

`apps/server/src/providers/factories/openai.ts`:
```ts
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export function makeOpenAI(opts: { apiKey: string; baseURL?: string; organization?: string }): (modelId: string) => LanguageModel {
  const provider = createOpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
    organization: opts.organization,
  });
  return (modelId) => provider(modelId);
}
```

`apps/server/src/providers/factories/google.ts`:
```ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export function makeGoogle(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const provider = createGoogleGenerativeAI({ apiKey: opts.apiKey });
  return (modelId) => provider(modelId);
}
```

`apps/server/src/providers/factories/groq.ts`:
```ts
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
export function makeGroq(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createGroq({ apiKey: opts.apiKey });
  return (m) => p(m);
}
```

`apps/server/src/providers/factories/xai.ts`:
```ts
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
export function makeXai(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createXai({ apiKey: opts.apiKey });
  return (m) => p(m);
}
```

`apps/server/src/providers/factories/deepseek.ts`:
```ts
import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModel } from 'ai';
export function makeDeepSeek(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createDeepSeek({ apiKey: opts.apiKey });
  return (m) => p(m);
}
```

`apps/server/src/providers/factories/openrouter.ts`:
```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
export function makeOpenRouter(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createOpenRouter({ apiKey: opts.apiKey });
  return (m) => p(m);
}
```

`apps/server/src/providers/factories/ollama.ts`:
```ts
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
export function makeOllama(opts: { baseURL?: string }): (modelId: string) => LanguageModel {
  const p = createOllama({ baseURL: opts.baseURL ?? 'http://localhost:11434/api' });
  return (m) => p(m);
}
```

`apps/server/src/providers/factories/openai-compatible.ts`:
```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
export function makeOpenAICompatible(opts: { name: string; apiKey?: string; baseURL: string }): (modelId: string) => LanguageModel {
  const p = createOpenAICompatible({ name: opts.name, apiKey: opts.apiKey, baseURL: opts.baseURL });
  return (m) => p(m);
}
```

`apps/server/src/providers/factories/vercel-gateway.ts`:
```ts
import { createGateway } from '@ai-sdk/gateway';
import type { LanguageModel } from 'ai';
export function makeVercelGateway(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createGateway({ apiKey: opts.apiKey });
  return (m) => p(m);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/providers/factories
git commit -m "feat(server/providers): direct-API factories for 10 providers"
```

---

## Task 5: Provider factories — CLI bridges

**Files:**
- Create: `apps/server/src/providers/factories/claude-code.ts`
- Create: `apps/server/src/providers/factories/gemini-cli.ts`
- Create: `apps/server/src/providers/factories/opencode.ts`

- [ ] **Step 1: Claude Code**

`apps/server/src/providers/factories/claude-code.ts`:
```ts
import { createClaudeCode } from 'ai-sdk-provider-claude-code';
import type { LanguageModel } from 'ai';

export function makeClaudeCode(opts: { binaryPath?: string }): (modelId: string) => LanguageModel {
  const provider = createClaudeCode({
    pathToClaudeCodeExecutable: opts.binaryPath,
  });
  return (modelId) => provider(modelId);
}
```

- [ ] **Step 2: Gemini CLI**

`apps/server/src/providers/factories/gemini-cli.ts`:
```ts
import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import type { LanguageModel } from 'ai';

export function makeGeminiCli(opts: { authType?: 'oauth-personal' | 'gemini-api-key'; apiKey?: string }): (modelId: string) => LanguageModel {
  const provider = createGeminiProvider({
    authType: opts.authType ?? 'oauth-personal',
    apiKey: opts.apiKey,
  });
  return (modelId) => provider(modelId);
}
```

- [ ] **Step 3: OpenCode**

`apps/server/src/providers/factories/opencode.ts`:
```ts
import { createOpencodeProvider } from 'ai-sdk-provider-opencode-sdk';
import type { LanguageModel } from 'ai';

export function makeOpencode(opts: Record<string, unknown> = {}): (modelId: string) => LanguageModel {
  const provider = createOpencodeProvider({ ...opts });
  return (modelId) => provider(modelId);
}
```

> **Note:** The exact factory function names and option shapes vary by SDK version. If the import names above don't match the version installed, run `cat node_modules/<pkg>/dist/index.d.ts` to find the actual exports and fix the import lines. The key invariant is: **return value is `(modelId: string) => LanguageModel`**.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/providers/factories
git commit -m "feat(server/providers): CLI-bridge factories (claude-code, gemini-cli, opencode)"
```

---

## Task 6: Readiness probes for CLI bridges

**Files:**
- Create: `apps/server/src/providers/readiness.test.ts`
- Create: `apps/server/src/providers/readiness.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/providers/readiness.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { probeCli, classifyProbeOutput } from './readiness';

describe('classifyProbeOutput', () => {
  it('treats normal --version output as ready', () => {
    expect(classifyProbeOutput({ exitCode: 0, stdout: '0.4.2\n', stderr: '' })).toBe('ready');
  });

  it('treats spawn failure as cli-not-found', () => {
    expect(classifyProbeOutput({ exitCode: -1, stdout: '', stderr: 'ENOENT' })).toBe('cli-not-found');
  });

  it('treats login-required messages as cli-not-authed', () => {
    expect(
      classifyProbeOutput({ exitCode: 1, stdout: '', stderr: 'Please run `claude login` first' }),
    ).toBe('cli-not-authed');
    expect(
      classifyProbeOutput({ exitCode: 1, stdout: '', stderr: 'Authentication required' }),
    ).toBe('cli-not-authed');
  });

  it('falls back to unknown on any other failure', () => {
    expect(classifyProbeOutput({ exitCode: 2, stdout: '', stderr: 'oops' })).toBe('unknown');
  });
});

describe('probeCli', () => {
  it('handles a missing binary gracefully', async () => {
    const status = await probeCli({ binary: 'this-binary-does-not-exist-please', args: ['--version'] });
    expect(status).toBe('cli-not-found');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/providers/readiness.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/providers/readiness.ts`:
```ts
import { spawn } from 'node:child_process';

export type ProbeOutput = { exitCode: number; stdout: string; stderr: string };
export type ProbeStatus = 'ready' | 'cli-not-found' | 'cli-not-authed' | 'unknown';

export function classifyProbeOutput(o: ProbeOutput): ProbeStatus {
  if (o.exitCode === 0) return 'ready';
  if (o.exitCode < 0 || /ENOENT|not recognized|command not found/i.test(o.stderr)) return 'cli-not-found';
  if (/login|authent|sign[- ]?in|token/i.test(o.stderr) || /login|authent/i.test(o.stdout)) {
    return 'cli-not-authed';
  }
  return 'unknown';
}

export async function probeCli(opts: { binary: string; args: string[]; timeoutMs?: number }): Promise<ProbeStatus> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  return new Promise<ProbeStatus>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(opts.binary, opts.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve(classifyProbeOutput({ exitCode: -1, stdout: '', stderr: String(err) }));
      return;
    }
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { proc.kill('SIGKILL'); } catch {}
      resolve('unknown');
    }, timeoutMs);

    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(classifyProbeOutput({ exitCode: -1, stdout, stderr: stderr || String(err) }));
    });
    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(classifyProbeOutput({ exitCode: code ?? -1, stdout, stderr }));
    });
  });
}

export async function probeForKind(kind: string): Promise<ProbeStatus> {
  switch (kind) {
    case 'claude-code': return probeCli({ binary: 'claude', args: ['--version'] });
    case 'gemini-cli': return probeCli({ binary: 'gemini', args: ['--version'] });
    case 'opencode': return probeCli({ binary: 'opencode', args: ['--version'] });
    default: return 'ready';   // direct-API kinds: probe is a separate model dry-run, see /api/providers/:id/test
  }
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/providers/readiness.test.ts
```
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/providers/readiness.ts apps/server/src/providers/readiness.test.ts
git commit -m "feat(server/providers): CLI readiness probe with status classification"
```

---

## Task 7: ProviderRegistry — resolve `id` → `LanguageModel`

**Files:**
- Create: `apps/server/src/providers/index.test.ts`
- Create: `apps/server/src/providers/index.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/providers/index.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { ProvidersRepo } from '../db/providers';
import { ProviderRegistry } from './index';

const isWin = process.platform === 'win32';

describe('ProviderRegistry', () => {
  let repo: ProvidersRepo;
  let reg: ProviderRegistry;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new ProvidersRepo(db);
    reg = new ProviderRegistry(repo);
  });

  it('returns null for unknown id', async () => {
    expect(await reg.resolve('p_nope', 'x')).toBeNull();
  });

  it.runIf(isWin)('resolves a stored Anthropic config to a LanguageModel', async () => {
    const id = repo.create({ kind: 'anthropic', label: 'A', apiKey: 'sk-test' });
    const model = await reg.resolve(id, 'claude-sonnet-4-6');
    expect(model).not.toBeNull();
    expect(typeof (model as any).provider).toBe('string'); // AI SDK LanguageModel has .provider
  });

  it('resolves a CLI bridge without a key', async () => {
    const id = repo.create({ kind: 'claude-code', label: 'C' });
    const model = await reg.resolve(id, 'claude-opus-4-7');
    expect(model).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/providers/index.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/providers/index.ts`:
```ts
import type { LanguageModel } from 'ai';
import { isCliBridge, type ProviderKind } from '@autooffice/shared';
import type { ProvidersRepo } from '../db/providers';
import { makeAnthropic } from './factories/anthropic';
import { makeOpenAI } from './factories/openai';
import { makeGoogle } from './factories/google';
import { makeGroq } from './factories/groq';
import { makeXai } from './factories/xai';
import { makeDeepSeek } from './factories/deepseek';
import { makeOpenRouter } from './factories/openrouter';
import { makeOllama } from './factories/ollama';
import { makeOpenAICompatible } from './factories/openai-compatible';
import { makeVercelGateway } from './factories/vercel-gateway';
import { makeClaudeCode } from './factories/claude-code';
import { makeGeminiCli } from './factories/gemini-cli';
import { makeOpencode } from './factories/opencode';
import { probeForKind, type ProbeStatus } from './readiness';

export class ProviderRegistry {
  constructor(private readonly repo: ProvidersRepo) {}

  async resolve(providerId: string, modelId: string): Promise<LanguageModel | null> {
    const cfg = this.repo.get(providerId);
    if (!cfg) return null;

    if (!isCliBridge(cfg.kind)) {
      const apiKey = this.repo.getDecryptedKey(providerId);
      if (apiKey == null) {
        throw new Error(`Provider '${cfg.label}' requires an API key`);
      }
      return this.buildDirect(cfg.kind, modelId, apiKey, cfg.config as Record<string, unknown>);
    }
    return this.buildCli(cfg.kind, modelId, cfg.config as Record<string, unknown>);
  }

  async getStatus(providerId: string): Promise<ProbeStatus> {
    const cfg = this.repo.get(providerId);
    if (!cfg) return 'unknown';
    if (isCliBridge(cfg.kind)) return probeForKind(cfg.kind);
    return this.repo.getDecryptedKey(providerId) ? 'ready' : 'needs-key' as ProbeStatus;
  }

  private buildDirect(
    kind: ProviderKind,
    modelId: string,
    apiKey: string,
    config: Record<string, unknown>,
  ): LanguageModel {
    switch (kind) {
      case 'anthropic': return makeAnthropic({ apiKey, baseURL: config.baseURL as string | undefined })(modelId);
      case 'openai': return makeOpenAI({
        apiKey,
        baseURL: config.baseURL as string | undefined,
        organization: config.organization as string | undefined,
      })(modelId);
      case 'google': return makeGoogle({ apiKey })(modelId);
      case 'groq': return makeGroq({ apiKey })(modelId);
      case 'xai': return makeXai({ apiKey })(modelId);
      case 'deepseek': return makeDeepSeek({ apiKey })(modelId);
      case 'openrouter': return makeOpenRouter({ apiKey })(modelId);
      case 'openai-compatible': return makeOpenAICompatible({
        name: (config.name as string) ?? 'compat',
        apiKey,
        baseURL: config.baseURL as string,
      })(modelId);
      case 'vercel-gateway': return makeVercelGateway({ apiKey })(modelId);
      case 'ollama': return makeOllama({ baseURL: config.baseURL as string | undefined })(modelId);
      default:
        throw new Error(`Unhandled direct provider kind: ${kind}`);
    }
  }

  private buildCli(
    kind: ProviderKind,
    modelId: string,
    config: Record<string, unknown>,
  ): LanguageModel {
    switch (kind) {
      case 'claude-code': return makeClaudeCode({ binaryPath: config.binaryPath as string | undefined })(modelId);
      case 'gemini-cli': return makeGeminiCli({
        authType: (config.authType as 'oauth-personal' | 'gemini-api-key' | undefined) ?? 'oauth-personal',
        apiKey: config.apiKey as string | undefined,
      })(modelId);
      case 'opencode': return makeOpencode(config)(modelId);
      default:
        throw new Error(`Unhandled CLI provider kind: ${kind}`);
    }
  }
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/providers/index.test.ts
```
Expected on Linux: 2 passing (Windows-only test skipped). On Windows: all 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/providers/index.ts apps/server/src/providers/index.test.ts
git commit -m "feat(server/providers): ProviderRegistry resolves id+model to LanguageModel"
```

---

## Task 8: `/api/providers` route

**Files:**
- Create: `apps/server/src/routes/providers.test.ts`
- Create: `apps/server/src/routes/providers.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/routes/providers.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

describe('providers routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 'test', db, authToken: TOKEN });
  });

  it('GET /api/providers returns []', async () => {
    const res = await app.request('/api/providers', { headers: auth });
    expect(await res.json()).toEqual([]);
  });

  it('POST /api/providers creates a CLI-bridge provider', async () => {
    const r = await app.request('/api/providers', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ kind: 'claude-code', label: 'My Claude' }),
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.id).toMatch(/^p_/);
    const list = await (await app.request('/api/providers', { headers: auth })).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'claude-code', hasKey: false });
  });

  it('PUT updates label', async () => {
    const id = (
      await (
        await app.request('/api/providers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ kind: 'claude-code', label: 'Old' }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/providers/${id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ label: 'New' }),
    });
    expect(r.status).toBe(200);
    const got = await r.json();
    expect(got.label).toBe('New');
  });

  it('DELETE removes', async () => {
    const id = (
      await (
        await app.request('/api/providers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ kind: 'claude-code', label: 'X' }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/providers/${id}`, { method: 'DELETE', headers: auth });
    expect(r.status).toBe(204);
  });

  it('rejects POST with invalid kind', async () => {
    const r = await app.request('/api/providers', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ kind: 'cohere', label: 'X' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /:id/test returns the readiness status', async () => {
    const id = (
      await (
        await app.request('/api/providers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ kind: 'claude-code', label: 'X' }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/providers/${id}/test`, { method: 'POST', headers: auth });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(['ready', 'cli-not-found', 'cli-not-authed', 'unknown']).toContain(body.status);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/providers.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement the route**

`apps/server/src/routes/providers.ts`:
```ts
import { Hono } from 'hono';
import {
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
} from '@autooffice/shared';
import type { ProvidersRepo } from '../db/providers';
import type { ProviderRegistry } from '../providers';

export function providersRouter(repo: ProvidersRepo, registry: ProviderRegistry) {
  const r = new Hono();

  r.get('/', async (c) => {
    const list = repo.list();
    const enriched = await Promise.all(list.map(async (p) => ({ ...p, status: await registry.getStatus(p.id) })));
    return c.json(enriched);
  });

  r.post('/', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = CreateProviderInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    try {
      const id = repo.create(parsed.data);
      return c.json({ id }, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  r.put('/:id', async (c) => {
    const id = c.req.param('id');
    if (!repo.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = UpdateProviderInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    try {
      repo.update(id, parsed.data);
      return c.json(repo.get(id));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  r.delete('/:id', (c) => {
    const id = c.req.param('id');
    repo.delete(id);
    return c.body(null, 204);
  });

  r.post('/:id/test', async (c) => {
    const id = c.req.param('id');
    if (!repo.get(id)) return c.json({ error: 'not found' }, 404);
    const status = await registry.getStatus(id);
    return c.json({ status });
  });

  return r;
}
```

- [ ] **Step 4: Wire into `app.ts`**

Replace the body of `createApp` in `apps/server/src/app.ts` with:
```ts
import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { providersRouter } from './routes/providers';
import { SettingsRepo } from './db/settings';
import { ConversationsRepo } from './db/conversations';
import { MessagesRepo } from './db/messages';
import { ProvidersRepo } from './db/providers';
import { ProviderRegistry } from './providers';

export type AppConfig = {
  version: string;
  db: Database;
  authToken: string;
};

export function createApp(config: AppConfig) {
  const app = new Hono();
  const settings = new SettingsRepo(config.db);
  const conversations = new ConversationsRepo(config.db);
  const messages = new MessagesRepo(config.db);
  const providers = new ProvidersRepo(config.db);
  const registry = new ProviderRegistry(providers);

  app.route('/', healthRouter(config.version));
  app.use('/api/*', bearerAuth(config.authToken));
  app.route('/api/settings', settingsRouter(settings));
  app.route('/api/conversations', conversationsRouter(conversations, messages));
  app.route('/api/providers', providersRouter(providers, registry));
  return app;
}
```

- [ ] **Step 5: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/providers.test.ts
```
Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): /api/providers CRUD + readiness probe endpoint"
```

---

## Task 9: Coverage and full-suite green

**Files:** None.

- [ ] **Step 1: Run all server tests with coverage**

```bash
npm --workspace @autooffice/server run test -- --coverage
```

- [ ] **Step 2: Add tests for any uncovered branches**

Likely candidates: error branches in routes (404 paths, invalid-JSON paths) and the `unknown` branch of `classifyProbeOutput`. Add focused tests; commit per the standard pattern.

- [ ] **Step 3: Push branch**

```bash
git push
```

CI's `vitest-linux` job must remain green.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: provider schema + repo, 10 direct-API factories, 3 CLI-bridge factories, readiness probes, `/api/providers/*` routes, encrypted key storage — all present.
- [x] No TODO/TBD placeholders.
- [x] Type names consistent across shared, repo, registry, routes.
- [x] DPAPI behavior gated by `process.platform === 'win32'` — test paths split correctly.
- [x] All AI SDK imports use the project's existing version pins where practical; CLI-bridge package versions noted as fluid (handled in Task 5 note).
- [x] No references to identifiers from later plans.
