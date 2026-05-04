# Local full-stack — Plan 02: SQLite + DPAPI secrets + settings & conversations API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the persistence layer of the local server: a `bun:sqlite` database with versioned migrations, a Windows DPAPI wrapper for secret-at-rest encryption, and CRUD APIs for settings and conversations behind a bearer-token middleware.

**Architecture:** All persistence lives under `%LOCALAPPDATA%\AutoOffice\` on Windows (and a configurable test path elsewhere). `db/index.ts` owns connection + migrations; `db/migrations/*.sql` are run in order at boot. Secrets (provider keys in plan 03) wrap through `secrets/dpapi.ts`, which uses `bun:ffi` against `crypt32.dll` on Windows and a no-op fallback elsewhere with explicit warning. Settings is a single-row JSON document; conversations and messages are normalized tables with `parts` stored as `UIMessage[]` JSON. Bearer-token enforcement is a Hono middleware; the token in this plan is loaded from an env var as a stub — plan 06 replaces that with the persisted per-install token.

**Tech Stack:** `bun:sqlite`, `bun:ffi` (Windows DPAPI), Hono, zod, vitest. No new external deps for the DB; bun's built-in SQLite avoids native-compile pain in `bun --compile`.

**Branch:** `feat/local-fullstack` (continued from plan 01)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Data model" and "Endpoint security".

---

## File structure after this plan

```
apps/server/
├── src/
│   ├── app.ts                        MODIFIED (mounts new routes + auth)
│   ├── db/
│   │   ├── index.ts                  NEW (open + migrate)
│   │   ├── index.test.ts             NEW
│   │   ├── migrations/
│   │   │   ├── 001_initial.sql       NEW (settings, conversations, messages)
│   │   │   └── 002_provider_mcp.sql  NEW (provider_configs, mcp_servers, mcp_tool_policies)
│   │   ├── conversations.ts          NEW (data access)
│   │   ├── conversations.test.ts     NEW
│   │   ├── messages.ts               NEW
│   │   ├── messages.test.ts          NEW
│   │   ├── settings.ts               NEW
│   │   └── settings.test.ts          NEW
│   ├── secrets/
│   │   ├── dpapi.ts                  NEW
│   │   └── dpapi.test.ts             NEW (skipped on non-Windows)
│   ├── middleware/
│   │   ├── auth.ts                   NEW
│   │   └── auth.test.ts              NEW
│   ├── env.ts                        MODIFIED (add DATA_DIR, AUTH_TOKEN)
│   └── routes/
│       ├── settings.ts               NEW
│       ├── settings.test.ts          NEW
│       ├── conversations.ts          NEW
│       └── conversations.test.ts     NEW
└── package.json                      MODIFIED (zod, ulid)

packages/shared/src/
├── index.ts                          MODIFIED (re-exports)
├── ids.ts                            NEW (ulid generator)
├── schemas/
│   ├── settings.ts                   NEW (SettingsSchema)
│   ├── conversation.ts               NEW (ConversationSchema, MessageSchema)
│   └── index.ts                      NEW (barrel)
```

---

## Task 1: Add the schemas in `packages/shared`

**Files:**
- Create: `packages/shared/src/ids.ts`
- Create: `packages/shared/src/schemas/settings.ts`
- Create: `packages/shared/src/schemas/conversation.ts`
- Create: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json` (add `ulid`)

- [ ] **Step 1: Add `ulid` dep**

Edit `packages/shared/package.json` `dependencies`:
```json
{
  "ulid": "^3.0.1",
  "zod": "^4.3.6"
}
```

Run:
```bash
npm install
```

- [ ] **Step 2: Create `ids.ts`**

`packages/shared/src/ids.ts`:
```ts
import { ulid } from 'ulid';

export function newId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}
```

- [ ] **Step 3: Create `schemas/settings.ts`**

`packages/shared/src/schemas/settings.ts`:
```ts
import { z } from 'zod';

export const SettingsSchema = z.object({
  locale: z.string().default('en'),
  autoApprove: z.boolean().default(false),
  maxSteps: z.number().int().min(1).max(50).default(20),
  selectedProviderId: z.string().nullable().default(null),
  selectedModelId: z.string().nullable().default(null),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
```

- [ ] **Step 4: Create `schemas/conversation.ts`**

`packages/shared/src/schemas/conversation.ts`:
```ts
import { z } from 'zod';

export const HostSchema = z.enum(['word', 'excel', 'powerpoint']);
export type Host = z.infer<typeof HostSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  host: HostSchema,
  providerId: z.string().nullable(),
  modelId: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.unknown()),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.number().int(),
});
export type Message = z.infer<typeof MessageSchema>;
```

- [ ] **Step 5: Create barrel and update root**

`packages/shared/src/schemas/index.ts`:
```ts
export * from './settings';
export * from './conversation';
```

`packages/shared/src/index.ts` (replace):
```ts
export * from './ids';
export * from './schemas';
```

- [ ] **Step 6: Add a sanity test for the schemas**

`packages/shared/src/schemas/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, SettingsSchema, ConversationSchema, MessageSchema } from './index';

describe('SettingsSchema', () => {
  it('produces sane defaults from {}', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      locale: 'en',
      autoApprove: false,
      maxSteps: 20,
      selectedProviderId: null,
      selectedModelId: null,
    });
  });

  it('rejects maxSteps below 1', () => {
    expect(() => SettingsSchema.parse({ maxSteps: 0 })).toThrow();
  });
});

describe('ConversationSchema', () => {
  it('rejects invalid host', () => {
    expect(() =>
      ConversationSchema.parse({
        id: 'c_1',
        title: null,
        host: 'outlook',
        providerId: null,
        modelId: null,
        createdAt: 1,
        updatedAt: 1,
      }),
    ).toThrow();
  });
});

describe('MessageSchema', () => {
  it('accepts an empty parts array', () => {
    const m = MessageSchema.parse({
      id: 'm_1',
      conversationId: 'c_1',
      role: 'user',
      parts: [],
      metadata: null,
      createdAt: 1,
    });
    expect(m.parts).toEqual([]);
  });
});
```

- [ ] **Step 7: Run tests and confirm passing**

```bash
npm --workspace @autooffice/shared run test
```
Expected: 3 passing tests.

- [ ] **Step 8: Commit**

```bash
git add packages/shared package.json package-lock.json
git commit -m "feat(shared): zod schemas for settings, conversations, messages + ulid ids"
```

---

## Task 2: Add server deps

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add zod and confirm bun built-ins**

Edit `apps/server/package.json` `dependencies`:
```json
{
  "@autooffice/shared": "*",
  "hono": "^4.6.0",
  "zod": "^4.3.6"
}
```

(Note: `bun:sqlite` and `bun:ffi` are built into the bun runtime — no npm install needed. `@hono/node-server` from plan 01 can be removed since we use `Bun.serve` directly. Leave it for now; cleanup in plan 06 once the server is fully on bun-only APIs.)

Run:
```bash
npm install
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/package.json package-lock.json
git commit -m "chore(server): add zod for runtime validation"
```

---

## Task 3: DB migration files

**Files:**
- Create: `apps/server/src/db/migrations/001_initial.sql`
- Create: `apps/server/src/db/migrations/002_provider_mcp.sql`

- [ ] **Step 1: Write `001_initial.sql`**

```sql
-- 001_initial.sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL  -- JSON
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  host TEXT NOT NULL,
  provider_id TEXT,
  model_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS conversations_updated_idx
  ON conversations(updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  parts TEXT NOT NULL,            -- UIMessage.parts JSON
  metadata TEXT,                  -- JSON
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_conv_idx
  ON messages(conversation_id, created_at);
```

- [ ] **Step 2: Write `002_provider_mcp.sql`**

```sql
-- 002_provider_mcp.sql
CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  config TEXT NOT NULL,           -- JSON, non-secret
  encrypted_key BLOB,             -- DPAPI-wrapped, NULL for CLI bridges
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  transport TEXT NOT NULL,        -- 'stdio' | 'sse' | 'streamable-http'
  command TEXT,
  args TEXT,                       -- JSON array
  cwd TEXT,
  env TEXT,                        -- JSON object
  url TEXT,
  headers TEXT,                    -- JSON object
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  default_policy TEXT NOT NULL DEFAULT 'ask' CHECK (default_policy IN ('allow','ask','deny')),
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_tool_policies (
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  policy TEXT NOT NULL CHECK (policy IN ('allow','ask','deny')),
  PRIMARY KEY (server_id, tool_name)
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/migrations
git commit -m "feat(server/db): SQL migrations 001 + 002 (initial schema)"
```

---

## Task 4: DB init + migration runner — failing test first

**Files:**
- Create: `apps/server/src/db/index.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/server/src/db/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb } from './index';

describe('openDb', () => {
  it('creates an in-memory db and runs all migrations', () => {
    const db = openDb({ url: ':memory:' });
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'schema_migrations',
        'settings',
        'conversations',
        'messages',
        'provider_configs',
        'mcp_servers',
        'mcp_tool_policies',
      ]),
    );
    db.close();
  });

  it('records applied migrations in schema_migrations', () => {
    const db = openDb({ url: ':memory:' });
    const versions = (db.query('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>).map((r) => r.version);
    expect(versions).toEqual([1, 2]);
    db.close();
  });

  it('is idempotent — second open does not re-apply migrations', () => {
    const db = openDb({ url: ':memory:' });
    const before = (db.query('SELECT count(*) AS c FROM schema_migrations').get() as { c: number }).c;
    // simulate reopen on the same connection
    db.exec('SELECT 1');
    const after = (db.query('SELECT count(*) AS c FROM schema_migrations').get() as { c: number }).c;
    expect(before).toBe(after);
    db.close();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/db/index.test.ts
```
Expected: FAIL — `openDb` not exported.

---

## Task 5: Implement `openDb`

**Files:**
- Create: `apps/server/src/db/index.ts`

- [ ] **Step 1: Implement**

`apps/server/src/db/index.ts`:
```ts
import { Database } from 'bun:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export type DbConfig = { url: string };

export function openDb(cfg: DbConfig): Database {
  const db = new Database(cfg.url, { create: true, strict: true });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set<number>(
    (db.query('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (r) => r.version,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();

  const insertStmt = db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );

  for (const file of files) {
    const version = Number(file.split('_', 1)[0]);
    if (applied.has(version)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      insertStmt.run(version, Date.now());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }

  return db;
}
```

- [ ] **Step 2: Run tests and confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/db/index.test.ts
```
Expected: 3 passing.

> **Note:** vitest must run under bun for `bun:sqlite` to load. Add a guard: edit `apps/server/vitest.config.ts` to set `test.environment = 'node'` (already done) and add a top-level conditional below — if running under Node (not bun), the test file dynamically imports a stub. For this plan we mandate `bun run test` for the server. Update `apps/server/package.json` `scripts.test` to:
>
> ```json
> "test": "bun --bun run vitest run"
> ```
>
> Re-run `npm --workspace @autooffice/server run test` to confirm.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/index.ts apps/server/src/db/index.test.ts apps/server/package.json
git commit -m "feat(server/db): openDb runs migrations idempotently under bun:sqlite"
```

---

## Task 6: Settings repository

**Files:**
- Create: `apps/server/src/db/settings.test.ts`
- Create: `apps/server/src/db/settings.ts`

- [ ] **Step 1: Write the failing test**

`apps/server/src/db/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { SettingsRepo } from './settings';
import { DEFAULT_SETTINGS } from '@autooffice/shared';

describe('SettingsRepo', () => {
  let repo: SettingsRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new SettingsRepo(db);
  });

  it('returns DEFAULT_SETTINGS on a fresh db', () => {
    expect(repo.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists a partial update', () => {
    repo.update({ autoApprove: true, maxSteps: 7 });
    const next = repo.get();
    expect(next.autoApprove).toBe(true);
    expect(next.maxSteps).toBe(7);
    expect(next.locale).toBe(DEFAULT_SETTINGS.locale);
  });

  it('rejects invalid values', () => {
    expect(() => repo.update({ maxSteps: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/db/settings.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/db/settings.ts`:
```ts
import type { Database } from 'bun:sqlite';
import { DEFAULT_SETTINGS, type Settings, SettingsSchema } from '@autooffice/shared';

const KEY = 'global';

export class SettingsRepo {
  constructor(private readonly db: Database) {}

  get(): Settings {
    const row = this.db
      .query<{ value: string }, [string]>('SELECT value FROM settings WHERE key = ?')
      .get(KEY);
    if (!row) return DEFAULT_SETTINGS;
    return SettingsSchema.parse(JSON.parse(row.value));
  }

  update(patch: Partial<Settings>): Settings {
    const merged = SettingsSchema.parse({ ...this.get(), ...patch });
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(KEY, JSON.stringify(merged));
    return merged;
  }
}
```

- [ ] **Step 4: Run tests and confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/db/settings.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/settings.ts apps/server/src/db/settings.test.ts
git commit -m "feat(server/db): SettingsRepo with default-merge + zod validation"
```

---

## Task 7: Conversations repository

**Files:**
- Create: `apps/server/src/db/conversations.test.ts`
- Create: `apps/server/src/db/conversations.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/db/conversations.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { ConversationsRepo } from './conversations';

describe('ConversationsRepo', () => {
  let repo: ConversationsRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new ConversationsRepo(db);
  });

  it('creates and reads back a conversation', () => {
    const id = repo.create({ host: 'word', providerId: null, modelId: null });
    expect(id).toMatch(/^c_/);
    const got = repo.get(id);
    expect(got).toMatchObject({ id, host: 'word', title: null });
    expect(got!.createdAt).toBeGreaterThan(0);
  });

  it('lists conversations newest first', async () => {
    const a = repo.create({ host: 'word' });
    await new Promise((r) => setTimeout(r, 5));
    const b = repo.create({ host: 'excel' });
    const list = repo.list();
    expect(list[0]!.id).toBe(b);
    expect(list[1]!.id).toBe(a);
  });

  it('rename updates title and updatedAt', async () => {
    const id = repo.create({ host: 'word' });
    const before = repo.get(id)!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    repo.rename(id, 'Hello');
    const after = repo.get(id)!;
    expect(after.title).toBe('Hello');
    expect(after.updatedAt).toBeGreaterThan(before);
  });

  it('delete cascades and removes the row', () => {
    const id = repo.create({ host: 'word' });
    repo.delete(id);
    expect(repo.get(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/db/conversations.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/db/conversations.ts`:
```ts
import type { Database } from 'bun:sqlite';
import {
  ConversationSchema,
  type Conversation,
  type Host,
  newId,
} from '@autooffice/shared';

export type CreateConversationInput = {
  host: Host;
  title?: string | null;
  providerId?: string | null;
  modelId?: string | null;
};

export class ConversationsRepo {
  constructor(private readonly db: Database) {}

  create(input: CreateConversationInput): string {
    const id = newId('c');
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO conversations (id, title, host, provider_id, model_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title ?? null,
        input.host,
        input.providerId ?? null,
        input.modelId ?? null,
        now,
        now,
      );
    return id;
  }

  get(id: string): Conversation | null {
    const row = this.db
      .query<
        {
          id: string;
          title: string | null;
          host: string;
          provider_id: string | null;
          model_id: string | null;
          created_at: number;
          updated_at: number;
        },
        [string]
      >('SELECT * FROM conversations WHERE id = ?')
      .get(id);
    if (!row) return null;
    return ConversationSchema.parse({
      id: row.id,
      title: row.title,
      host: row.host,
      providerId: row.provider_id,
      modelId: row.model_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  list(): Conversation[] {
    const rows = this.db
      .query<
        {
          id: string;
          title: string | null;
          host: string;
          provider_id: string | null;
          model_id: string | null;
          created_at: number;
          updated_at: number;
        },
        []
      >(
        'SELECT id, title, host, provider_id, model_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
      )
      .all();
    return rows.map((row) =>
      ConversationSchema.parse({
        id: row.id,
        title: row.title,
        host: row.host,
        providerId: row.provider_id,
        modelId: row.model_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  rename(id: string, title: string): void {
    this.db
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), id);
  }

  touch(id: string): void {
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(Date.now(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/db/conversations.test.ts
```
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/conversations.ts apps/server/src/db/conversations.test.ts
git commit -m "feat(server/db): ConversationsRepo (CRUD + list newest-first)"
```

---

## Task 8: Messages repository

**Files:**
- Create: `apps/server/src/db/messages.test.ts`
- Create: `apps/server/src/db/messages.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/db/messages.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { ConversationsRepo } from './conversations';
import { MessagesRepo } from './messages';

describe('MessagesRepo', () => {
  let convs: ConversationsRepo;
  let msgs: MessagesRepo;
  let convId: string;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    convs = new ConversationsRepo(db);
    msgs = new MessagesRepo(db);
    convId = convs.create({ host: 'word' });
  });

  it('appends and reads messages in insertion order', () => {
    msgs.append({
      id: 'msg_1',
      conversationId: convId,
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      metadata: null,
    });
    msgs.append({
      id: 'msg_2',
      conversationId: convId,
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello' }],
      metadata: null,
    });
    const list = msgs.listByConversation(convId);
    expect(list.map((m) => m.id)).toEqual(['msg_1', 'msg_2']);
    expect((list[1]!.parts[0] as any).text).toBe('hello');
  });

  it('replaceAll wipes prior messages and inserts fresh', () => {
    msgs.append({
      id: 'msg_old',
      conversationId: convId,
      role: 'user',
      parts: [],
      metadata: null,
    });
    msgs.replaceAll(convId, [
      { id: 'msg_new1', conversationId: convId, role: 'user', parts: [], metadata: null },
      { id: 'msg_new2', conversationId: convId, role: 'assistant', parts: [], metadata: null },
    ]);
    expect(msgs.listByConversation(convId).map((m) => m.id)).toEqual(['msg_new1', 'msg_new2']);
  });

  it('cascades on conversation delete', () => {
    msgs.append({
      id: 'msg_a',
      conversationId: convId,
      role: 'user',
      parts: [],
      metadata: null,
    });
    convs.delete(convId);
    expect(msgs.listByConversation(convId)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/db/messages.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/db/messages.ts`:
```ts
import type { Database } from 'bun:sqlite';
import { MessageSchema, type Message } from '@autooffice/shared';

export type AppendInput = Omit<Message, 'createdAt'>;

export class MessagesRepo {
  constructor(private readonly db: Database) {}

  append(input: AppendInput): void {
    const created = Date.now();
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, parts, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.conversationId,
        input.role,
        JSON.stringify(input.parts ?? []),
        input.metadata == null ? null : JSON.stringify(input.metadata),
        created,
      );
  }

  replaceAll(conversationId: string, messages: AppendInput[]): void {
    const tx = this.db.transaction((items: AppendInput[]) => {
      this.db
        .prepare('DELETE FROM messages WHERE conversation_id = ?')
        .run(conversationId);
      let i = 0;
      const insert = this.db.prepare(
        `INSERT INTO messages (id, conversation_id, role, parts, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const m of items) {
        insert.run(
          m.id,
          m.conversationId,
          m.role,
          JSON.stringify(m.parts ?? []),
          m.metadata == null ? null : JSON.stringify(m.metadata),
          Date.now() + i++,
        );
      }
    });
    tx(messages);
  }

  listByConversation(conversationId: string): Message[] {
    const rows = this.db
      .query<
        {
          id: string;
          conversation_id: string;
          role: string;
          parts: string;
          metadata: string | null;
          created_at: number;
        },
        [string]
      >(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      )
      .all(conversationId);
    return rows.map((row) =>
      MessageSchema.parse({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        parts: JSON.parse(row.parts),
        metadata: row.metadata == null ? null : JSON.parse(row.metadata),
        createdAt: row.created_at,
      }),
    );
  }
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/db/messages.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/messages.ts apps/server/src/db/messages.test.ts
git commit -m "feat(server/db): MessagesRepo (append, replaceAll, list, cascade)"
```

---

## Task 9: DPAPI wrapper for Windows

**Files:**
- Create: `apps/server/src/secrets/dpapi.ts`
- Create: `apps/server/src/secrets/dpapi.test.ts`

- [ ] **Step 1: Write the test**

`apps/server/src/secrets/dpapi.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { wrapSecret, unwrapSecret, isDpapiAvailable } from './dpapi';

const isWindows = process.platform === 'win32';

describe.runIf(isWindows)('DPAPI (Windows)', () => {
  it('round-trips a secret', () => {
    expect(isDpapiAvailable()).toBe(true);
    const ciphertext = wrapSecret('hunter2');
    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(ciphertext.byteLength).toBeGreaterThan(0);
    const back = unwrapSecret(ciphertext);
    expect(back).toBe('hunter2');
  });
});

describe.skipIf(isWindows)('DPAPI (non-Windows)', () => {
  it('reports unavailable and refuses to wrap', () => {
    expect(isDpapiAvailable()).toBe(false);
    expect(() => wrapSecret('x')).toThrow(/Windows/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/secrets/dpapi.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/secrets/dpapi.ts`:
```ts
// Windows DPAPI wrapper bound to the current user.
// Wraps with CRYPTPROTECT_UI_FORBIDDEN; no entropy for now (machine + user identity is enough).
import { dlopen, FFIType, ptr, suffix } from 'bun:ffi';

const isWindows = process.platform === 'win32';

type DpapiBindings = {
  CryptProtectData: (
    pDataIn: number,
    szDataDescr: number,
    pOptionalEntropy: number,
    pvReserved: number,
    pPromptStruct: number,
    dwFlags: number,
    pDataOut: number,
  ) => number;
  CryptUnprotectData: (
    pDataIn: number,
    ppszDataDescr: number,
    pOptionalEntropy: number,
    pvReserved: number,
    pPromptStruct: number,
    dwFlags: number,
    pDataOut: number,
  ) => number;
  LocalFree: (h: number) => number;
};

let crypt32: DpapiBindings | null = null;
let kernel32: { LocalFree: (h: number) => number } | null = null;

function load(): DpapiBindings {
  if (!isWindows) {
    throw new Error('DPAPI is only available on Windows');
  }
  if (crypt32) return crypt32;
  const c = dlopen(`crypt32.${suffix}`, {
    CryptProtectData: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
    CryptUnprotectData: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
  } as const);
  const k = dlopen(`kernel32.${suffix}`, {
    LocalFree: { args: [FFIType.ptr], returns: FFIType.ptr },
  } as const);
  crypt32 = c.symbols as unknown as DpapiBindings;
  kernel32 = k.symbols as unknown as { LocalFree: (h: number) => number };
  return crypt32;
}

export function isDpapiAvailable(): boolean {
  return isWindows;
}

// DATA_BLOB layout: u32 cbData; ptr pbData
function makeBlob(buf: Uint8Array): { ptr: number; struct: ArrayBuffer } {
  const struct = new ArrayBuffer(16); // 4 padding for alignment + 8 for u64 ptr (x64)
  const view = new DataView(struct);
  view.setUint32(0, buf.byteLength, true);
  // ptr is x64 8-byte at offset 8
  const bufPtr = ptr(buf);
  // Bun's ptr() returns a number (BigInt on x64). Encode as little-endian 8 bytes.
  view.setBigUint64(8, BigInt(bufPtr), true);
  return { ptr: ptr(new Uint8Array(struct)), struct };
}

function readBlob(structPtr: number): Uint8Array {
  // Read DATA_BLOB at structPtr: u32 cbData @ 0, ptr pbData @ 8
  const header = new Uint8Array(16);
  // read raw bytes via toArrayBuffer
  // bun:ffi exposes toArrayBuffer for pointers
  const { toArrayBuffer } = require('bun:ffi') as typeof import('bun:ffi');
  const headerBuf = toArrayBuffer(structPtr, 0, 16);
  const view = new DataView(headerBuf);
  const cb = view.getUint32(0, true);
  const dataPtr = Number(view.getBigUint64(8, true));
  const data = new Uint8Array(toArrayBuffer(dataPtr, 0, cb));
  // Caller must LocalFree dataPtr.
  // copy out before freeing.
  const copy = new Uint8Array(cb);
  copy.set(data);
  return copy;
}

export function wrapSecret(plaintext: string): Uint8Array {
  const fn = load();
  const inBytes = new TextEncoder().encode(plaintext);
  const inBlob = makeBlob(inBytes);

  const outStruct = new ArrayBuffer(16);
  const outPtr = ptr(new Uint8Array(outStruct));

  const CRYPTPROTECT_UI_FORBIDDEN = 0x1;
  const ok = fn.CryptProtectData(inBlob.ptr, 0, 0, 0, 0, CRYPTPROTECT_UI_FORBIDDEN, outPtr);
  if (!ok) {
    throw new Error('CryptProtectData failed');
  }
  const cipher = readBlob(outPtr);
  // Free the LPVOID inside the out blob:
  const view = new DataView(outStruct);
  const dataPtr = Number(view.getBigUint64(8, true));
  kernel32!.LocalFree(dataPtr);
  return cipher;
}

export function unwrapSecret(ciphertext: Uint8Array): string {
  const fn = load();
  const inBlob = makeBlob(ciphertext);

  const outStruct = new ArrayBuffer(16);
  const outPtr = ptr(new Uint8Array(outStruct));

  const CRYPTPROTECT_UI_FORBIDDEN = 0x1;
  const ok = fn.CryptUnprotectData(inBlob.ptr, 0, 0, 0, 0, CRYPTPROTECT_UI_FORBIDDEN, outPtr);
  if (!ok) {
    throw new Error('CryptUnprotectData failed');
  }
  const plain = readBlob(outPtr);
  const view = new DataView(outStruct);
  const dataPtr = Number(view.getBigUint64(8, true));
  kernel32!.LocalFree(dataPtr);
  return new TextDecoder().decode(plain);
}
```

> **Note:** `bun:ffi` pointer interop and DATA_BLOB struct marshaling is finicky. If round-trip fails on Windows, prefer calling out via PowerShell as a fallback (`powershell -Command "[System.Security.Cryptography.ProtectedData]::Protect(...)"`). Document the fallback as Task 9b if needed but try the FFI path first.

- [ ] **Step 4: Run tests on the current platform**

```bash
npm --workspace @autooffice/server run test -- src/secrets/dpapi.test.ts
```
Expected on Linux: the non-Windows test passes; Windows test is skipped. On Windows: round-trip passes.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/secrets
git commit -m "feat(server/secrets): DPAPI wrap/unwrap via bun:ffi (Windows only)"
```

---

## Task 10: Bearer-token middleware

**Files:**
- Create: `apps/server/src/middleware/auth.ts`
- Create: `apps/server/src/middleware/auth.test.ts`
- Modify: `apps/server/src/env.ts`

- [ ] **Step 1: Add token env var**

Replace `apps/server/src/env.ts`:
```ts
export const PORT = Number(process.env.AUTOOFFICE_PORT ?? 47318);
export const HOST = process.env.AUTOOFFICE_HOST ?? '127.0.0.1';
export const VERSION = process.env.AUTOOFFICE_VERSION ?? '0.0.0-dev';
export const IS_DEV = process.env.NODE_ENV !== 'production';
export const AUTH_TOKEN = process.env.AUTOOFFICE_TOKEN ?? 'dev-token-replace-me';
export const DATA_DIR = process.env.AUTOOFFICE_DATA_DIR ?? '';
```

- [ ] **Step 2: Failing test**

`apps/server/src/middleware/auth.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bearerAuth } from './auth';

describe('bearerAuth', () => {
  function makeApp(token: string) {
    const app = new Hono();
    app.get('/health', (c) => c.json({ ok: true }));
    app.use('/api/*', bearerAuth(token));
    app.get('/api/secret', (c) => c.json({ secret: 'shh' }));
    return app;
  }

  it('allows /health without token', async () => {
    const app = makeApp('t1');
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('rejects /api/* without Authorization', async () => {
    const app = makeApp('t1');
    const res = await app.request('/api/secret');
    expect(res.status).toBe(401);
  });

  it('rejects /api/* with wrong token', async () => {
    const app = makeApp('t1');
    const res = await app.request('/api/secret', {
      headers: { Authorization: 'Bearer wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts /api/* with correct token', async () => {
    const app = makeApp('t1');
    const res = await app.request('/api/secret', {
      headers: { Authorization: 'Bearer t1' },
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/middleware/auth.test.ts
```
Expected: FAIL.

- [ ] **Step 4: Implement**

`apps/server/src/middleware/auth.ts`:
```ts
import type { MiddlewareHandler } from 'hono';

export function bearerAuth(expected: string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match || match[1] !== expected) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  };
}
```

- [ ] **Step 5: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/middleware/auth.test.ts
```
Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/middleware/auth.ts apps/server/src/middleware/auth.test.ts apps/server/src/env.ts
git commit -m "feat(server): bearerAuth middleware (gates /api/* but not /health)"
```

---

## Task 11: `/api/settings` route

**Files:**
- Create: `apps/server/src/routes/settings.test.ts`
- Create: `apps/server/src/routes/settings.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/routes/settings.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db/index';
import { createApp } from '../app';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };

describe('settings routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 'test', db, authToken: TOKEN });
  });

  it('GET /api/settings returns defaults on a fresh db', async () => {
    const res = await app.request('/api/settings', { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ locale: 'en', autoApprove: false, maxSteps: 20 });
  });

  it('PUT /api/settings persists a partial update', async () => {
    const res = await app.request('/api/settings', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoApprove: true, maxSteps: 10 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ autoApprove: true, maxSteps: 10 });

    const res2 = await app.request('/api/settings', { headers: auth });
    expect((await res2.json()).autoApprove).toBe(true);
  });

  it('PUT rejects an invalid maxSteps', async () => {
    const res = await app.request('/api/settings', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSteps: 0 }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/settings.test.ts
```
Expected: FAIL — `createApp` doesn't accept `db`.

- [ ] **Step 3: Update `app.ts` to accept the new dependencies**

Replace `apps/server/src/app.ts`:
```ts
import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { SettingsRepo } from './db/settings';
import { ConversationsRepo } from './db/conversations';
import { MessagesRepo } from './db/messages';

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

  app.route('/', healthRouter(config.version));
  app.use('/api/*', bearerAuth(config.authToken));
  app.route('/api/settings', settingsRouter(settings));
  app.route('/api/conversations', conversationsRouter(conversations, messages));
  return app;
}
```

> **Note:** the existing `createApp({ version })` callers will break. Update the existing `health.test.ts` to pass a stub:
>
> ```ts
> import { openDb } from '../db';
> const db = openDb({ url: ':memory:' });
> const app = createApp({ version: '0.0.0-test', db, authToken: 't' });
> ```

Apply that change to `apps/server/src/routes/health.test.ts` and to `apps/server/src/index.ts` (for index.ts, open the DB at startup — see Task 13).

- [ ] **Step 4: Implement `settingsRouter`**

`apps/server/src/routes/settings.ts`:
```ts
import { Hono } from 'hono';
import { SettingsSchema, type Settings } from '@autooffice/shared';
import type { SettingsRepo } from '../db/settings';

export function settingsRouter(repo: SettingsRepo) {
  const r = new Hono();

  r.get('/', (c) => c.json(repo.get()));

  r.put('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = SettingsSchema.partial().safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    }
    const next: Settings = repo.update(parsed.data);
    return c.json(next);
  });

  return r;
}
```

- [ ] **Step 5: Provide a stub for conversations router so app compiles**

`apps/server/src/routes/conversations.ts` — minimal placeholder:
```ts
import { Hono } from 'hono';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';

export function conversationsRouter(_convs: ConversationsRepo, _msgs: MessagesRepo) {
  return new Hono(); // filled in next task
}
```

- [ ] **Step 6: Run settings tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/settings.test.ts
```
Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): /api/settings GET/PUT with zod validation"
```

---

## Task 12: `/api/conversations` route

**Files:**
- Create: `apps/server/src/routes/conversations.test.ts`
- Modify: `apps/server/src/routes/conversations.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/routes/conversations.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db/index';
import { createApp } from '../app';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

describe('conversations routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 'test', db, authToken: TOKEN });
  });

  it('GET /api/conversations on empty db returns []', async () => {
    const res = await app.request('/api/conversations', { headers: auth });
    expect(await res.json()).toEqual([]);
  });

  it('POST creates a conversation and returns id', async () => {
    const res = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ host: 'word' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^c_/);
  });

  it('GET /:id returns conversation with messages: []', async () => {
    const created = await (
      await app.request('/api/conversations', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ host: 'excel' }),
      })
    ).json();
    const res = await app.request(`/api/conversations/${created.id}`, { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversation.host).toBe('excel');
    expect(body.messages).toEqual([]);
  });

  it('PATCH renames the conversation', async () => {
    const c = await (
      await app.request('/api/conversations', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ host: 'word' }),
      })
    ).json();
    const r = await app.request(`/api/conversations/${c.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ title: 'Sprint plan' }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.title).toBe('Sprint plan');
  });

  it('DELETE returns 204', async () => {
    const c = await (
      await app.request('/api/conversations', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ host: 'word' }),
      })
    ).json();
    const r = await app.request(`/api/conversations/${c.id}`, {
      method: 'DELETE',
      headers: auth,
    });
    expect(r.status).toBe(204);
    const list = await (await app.request('/api/conversations', { headers: auth })).json();
    expect(list).toHaveLength(0);
  });

  it('rejects invalid host in POST', async () => {
    const r = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ host: 'outlook' }),
    });
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/conversations.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement the router**

Replace `apps/server/src/routes/conversations.ts`:
```ts
import { Hono } from 'hono';
import { z } from 'zod';
import { HostSchema } from '@autooffice/shared';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';

const CreateBody = z.object({
  host: HostSchema,
  title: z.string().nullish(),
  providerId: z.string().nullish(),
  modelId: z.string().nullish(),
});

const PatchBody = z.object({ title: z.string().min(1).max(200) });

export function conversationsRouter(convs: ConversationsRepo, msgs: MessagesRepo) {
  const r = new Hono();

  r.get('/', (c) => c.json(convs.list()));

  r.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const id = convs.create({
      host: parsed.data.host,
      title: parsed.data.title ?? null,
      providerId: parsed.data.providerId ?? null,
      modelId: parsed.data.modelId ?? null,
    });
    return c.json({ id }, 201);
  });

  r.get('/:id', (c) => {
    const id = c.req.param('id');
    const conversation = convs.get(id);
    if (!conversation) return c.json({ error: 'not found' }, 404);
    const messages = msgs.listByConversation(id);
    return c.json({ conversation, messages });
  });

  r.patch('/:id', async (c) => {
    const id = c.req.param('id');
    if (!convs.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    convs.rename(id, parsed.data.title);
    return c.json(convs.get(id));
  });

  r.delete('/:id', (c) => {
    const id = c.req.param('id');
    convs.delete(id);
    return c.body(null, 204);
  });

  return r;
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/conversations.test.ts
```
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/conversations.ts apps/server/src/routes/conversations.test.ts
git commit -m "feat(server): /api/conversations CRUD with messages list"
```

---

## Task 13: Wire DB into the entry point

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/env.ts`

- [ ] **Step 1: Add resolution helper for DATA_DIR**

`apps/server/src/env.ts` — replace fully:
```ts
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PORT = Number(process.env.AUTOOFFICE_PORT ?? 47318);
export const HOST = process.env.AUTOOFFICE_HOST ?? '127.0.0.1';
export const VERSION = process.env.AUTOOFFICE_VERSION ?? '0.0.0-dev';
export const IS_DEV = process.env.NODE_ENV !== 'production';
export const AUTH_TOKEN = process.env.AUTOOFFICE_TOKEN ?? 'dev-token-replace-me';

export function resolveDataDir(): string {
  const override = process.env.AUTOOFFICE_DATA_DIR;
  if (override) {
    mkdirSync(override, { recursive: true });
    return override;
  }
  const isWin = process.platform === 'win32';
  const base = isWin
    ? process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local')
    : join(homedir(), '.local', 'share');
  const dir = join(base, 'AutoOffice');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return join(resolveDataDir(), 'app.db');
}
```

- [ ] **Step 2: Use it in `index.ts`**

`apps/server/src/index.ts` — replace fully:
```ts
import { createApp } from './app';
import { openDb } from './db/index';
import { AUTH_TOKEN, HOST, IS_DEV, PORT, VERSION, dbPath } from './env';

const db = openDb({ url: dbPath() });
const app = createApp({ version: VERSION, db, authToken: AUTH_TOKEN });

if (IS_DEV) {
  const { makeViteMiddleware } = await import('./middleware/vite-dev');
  app.use('*', await makeViteMiddleware());
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: app.fetch,
});

console.log(`[autoOffice] ${IS_DEV ? 'dev' : 'prod'} listening on http://${server.hostname}:${server.port}`);
console.log(`[autoOffice] data dir = ${dbPath()}`);
```

- [ ] **Step 3: Smoke-test**

Set the dev token and start:
```bash
AUTOOFFICE_TOKEN=devtoken npm --workspace @autooffice/server run dev
```

In another shell:
```bash
curl -s -H "Authorization: Bearer devtoken" http://127.0.0.1:47318/api/settings
```
Expected: JSON with default settings.

```bash
curl -s -X POST -H "Authorization: Bearer devtoken" -H 'Content-Type: application/json' \
  -d '{"host":"word"}' http://127.0.0.1:47318/api/conversations
```
Expected: `{"id":"c_..."}`.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/index.ts apps/server/src/env.ts
git commit -m "feat(server): boot opens the DB from %LOCALAPPDATA%\\AutoOffice"
```

---

## Task 14: Run all server tests for coverage

**Files:** None.

- [ ] **Step 1: Run with coverage**

```bash
npm --workspace @autooffice/server run test -- --coverage
```
Expected: thresholds (80/70/80/80) met. If not, add focused tests for the uncovered branches in this plan's files (most likely the conversation 404 paths or the middleware reject paths).

- [ ] **Step 2: Commit any added tests**

If you added tests, commit them with:
```bash
git add apps/server/src
git commit -m "test(server): cover remaining branches to hit 80/70 thresholds"
```

- [ ] **Step 3: Push branch**

```bash
git push
```

CI must remain green for the `vitest-linux` job.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: SQLite + migrations, DPAPI wrapper, `/api/settings`, `/api/conversations`, bearer auth — all present.
- [x] No TODO/TBD placeholders.
- [x] Type names consistent: `Conversation`, `Message`, `Settings`, `Host` exported from shared, used in repo + routes.
- [x] Each new module has a paired test and TDD shape.
- [x] No references to identifiers from later plans.
- [x] DPAPI test handles non-Windows correctly (skipped + alternative test path).
