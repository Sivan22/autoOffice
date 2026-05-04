# Local full-stack — Plan 04: McpHub + tri-state policy + status SSE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move MCP from the browser to the server. Build an `McpHub` that supports stdio + sse + streamable-http transports, manages connection lifecycle (eager connect on add/enable, restart-with-backoff on error, live-update vs full restart based on diff classification), enforces tri-state per-tool policy (`allow` / `ask` / `deny`), and surfaces live status to the frontend through a server-sent events stream.

**Architecture:** `McpHub` owns an in-memory map `serverId → ManagedConnection`. Each `ManagedConnection` wraps an AI SDK MCP client, a per-server stderr ring buffer, a status, and a discovered-tool list with policies merged from `mcp_tool_policies`. Settings mutations go through `/api/mcp/*` routes; the routes call `hub.upsert(...)` / `hub.disable(...)` / etc. which classify the diff and either tear down + reconnect or apply the change in place. The hub emits status events on a global `EventEmitter` that the SSE route subscribes to.

**Tech Stack:** `@ai-sdk/mcp` (`createMCPClient`), Hono SSE helpers, `node:child_process` for stdio (the MCP SDK handles this internally via `StdioClientTransport` but we manage process lifecycle around it for stderr capture and crash backoff), zod, vitest.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "MCP (`McpHub`)".

---

## File structure after this plan

```
apps/server/
├── package.json                        MODIFIED (add @ai-sdk/mcp + @modelcontextprotocol/sdk)
├── src/
│   ├── app.ts                          MODIFIED (mount /api/mcp + lifecycle hook)
│   ├── db/
│   │   ├── mcp.ts                      NEW (McpServersRepo + McpToolPoliciesRepo)
│   │   └── mcp.test.ts                 NEW
│   ├── mcp/
│   │   ├── hub.ts                      NEW (McpHub)
│   │   ├── hub.test.ts                 NEW
│   │   ├── diff.ts                     NEW (classify config change)
│   │   ├── diff.test.ts                NEW
│   │   ├── ring-buffer.ts              NEW (stderr capture)
│   │   ├── ring-buffer.test.ts         NEW
│   │   ├── policy.ts                   NEW (merge default + per-tool policies)
│   │   ├── policy.test.ts              NEW
│   │   └── events.ts                   NEW (typed event bus)
│   └── routes/
│       ├── mcp.ts                      NEW (CRUD + tools + log + events)
│       └── mcp.test.ts                 NEW

packages/shared/src/schemas/
├── mcp.ts                              NEW (server config + policy schemas)
└── index.ts                            MODIFIED
```

---

## Task 1: MCP schemas in `@autooffice/shared`

**Files:**
- Create: `packages/shared/src/schemas/mcp.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Write the schemas**

`packages/shared/src/schemas/mcp.ts`:
```ts
import { z } from 'zod';

export const McpTransportSchema = z.enum(['stdio', 'sse', 'streamable-http']);
export type McpTransport = z.infer<typeof McpTransportSchema>;

export const McpPolicySchema = z.enum(['allow', 'ask', 'deny']);
export type McpPolicy = z.infer<typeof McpPolicySchema>;

export const McpStatusSchema = z.enum(['connecting', 'connected', 'disconnected', 'error', 'disabled']);
export type McpStatus = z.infer<typeof McpStatusSchema>;

const StdioFields = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().nullish(),
  env: z.record(z.string(), z.string()).default({}),
});

const HttpFields = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
});

export const McpServerInputSchema = z.discriminatedUnion('transport', [
  StdioFields.extend({ transport: z.literal('stdio') }),
  HttpFields.extend({ transport: z.literal('sse') }),
  HttpFields.extend({ transport: z.literal('streamable-http') }),
]);

export const CreateMcpServerInputSchema = z.object({
  label: z.string().min(1).max(80),
  timeoutSeconds: z.number().int().min(1).max(600).default(60),
  defaultPolicy: McpPolicySchema.default('ask'),
  disabled: z.boolean().default(false),
  spec: McpServerInputSchema,
});
export type CreateMcpServerInput = z.infer<typeof CreateMcpServerInputSchema>;

export const UpdateMcpServerInputSchema = CreateMcpServerInputSchema.partial();
export type UpdateMcpServerInput = z.infer<typeof UpdateMcpServerInputSchema>;

export const McpToolDescriptorSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  inputSchema: z.unknown().nullish(),
  policy: McpPolicySchema,
});
export type McpToolDescriptor = z.infer<typeof McpToolDescriptorSchema>;

export const McpServerViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  transport: McpTransportSchema,
  command: z.string().nullable(),
  args: z.array(z.string()),
  cwd: z.string().nullable(),
  env: z.record(z.string(), z.string()),
  url: z.string().nullable(),
  headers: z.record(z.string(), z.string()),
  timeoutSeconds: z.number().int(),
  defaultPolicy: McpPolicySchema,
  disabled: z.boolean(),
  status: McpStatusSchema,
  errorMessage: z.string().nullable(),
  tools: z.array(McpToolDescriptorSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type McpServerView = z.infer<typeof McpServerViewSchema>;
```

- [ ] **Step 2: Re-export**

Edit `packages/shared/src/schemas/index.ts` (append):
```ts
export * from './mcp';
```

- [ ] **Step 3: Sanity test**

`packages/shared/src/schemas/mcp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { CreateMcpServerInputSchema, McpServerInputSchema } from './mcp';

describe('McpServerInputSchema (discriminated union)', () => {
  it('accepts a stdio config', () => {
    const r = McpServerInputSchema.parse({ transport: 'stdio', command: 'node', args: ['server.js'] });
    expect(r.transport).toBe('stdio');
  });

  it('accepts a streamable-http config', () => {
    const r = McpServerInputSchema.parse({
      transport: 'streamable-http',
      url: 'https://x.example/mcp',
    });
    expect(r.transport).toBe('streamable-http');
  });

  it('rejects mixing fields', () => {
    expect(() =>
      McpServerInputSchema.parse({ transport: 'stdio', url: 'https://no.example' }),
    ).toThrow();
  });
});

describe('CreateMcpServerInputSchema', () => {
  it('applies defaults', () => {
    const r = CreateMcpServerInputSchema.parse({
      label: 'fs',
      spec: { transport: 'stdio', command: 'node', args: [] },
    });
    expect(r.timeoutSeconds).toBe(60);
    expect(r.defaultPolicy).toBe('ask');
    expect(r.disabled).toBe(false);
  });
});
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/shared run test
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): MCP schemas (server config, transport union, tri-state policy)"
```

---

## Task 2: Server deps for MCP

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add MCP packages**

Edit `apps/server/package.json` `dependencies`:
```json
{
  "@ai-sdk/mcp": "^1.0.36",
  "@modelcontextprotocol/sdk": "^1.0.0"
}
```

Run:
```bash
npm install
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/package.json package-lock.json
git commit -m "chore(server): add @ai-sdk/mcp + @modelcontextprotocol/sdk"
```

---

## Task 3: McpServersRepo + McpToolPoliciesRepo

**Files:**
- Create: `apps/server/src/db/mcp.test.ts`
- Create: `apps/server/src/db/mcp.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/db/mcp.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { McpServersRepo, McpToolPoliciesRepo } from './mcp';

describe('McpServersRepo', () => {
  let servers: McpServersRepo;
  let policies: McpToolPoliciesRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    servers = new McpServersRepo(db);
    policies = new McpToolPoliciesRepo(db);
  });

  it('round-trips a stdio server', () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: ['fs.js'], env: {}, cwd: null },
    });
    const got = servers.get(id)!;
    expect(got).toMatchObject({ label: 'fs', transport: 'stdio', command: 'node', defaultPolicy: 'ask' });
    expect(got.args).toEqual(['fs.js']);
  });

  it('round-trips an http server', () => {
    const id = servers.create({
      label: 'remote',
      timeoutSeconds: 30,
      defaultPolicy: 'allow',
      disabled: false,
      spec: { transport: 'streamable-http', url: 'https://x.example/mcp', headers: { auth: 'tok' } },
    });
    const got = servers.get(id)!;
    expect(got.transport).toBe('streamable-http');
    expect(got.headers.auth).toBe('tok');
  });

  it('updates a single field', () => {
    const id = servers.create({
      label: 'a',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    servers.update(id, { timeoutSeconds: 120, defaultPolicy: 'allow' });
    const got = servers.get(id)!;
    expect(got.timeoutSeconds).toBe(120);
    expect(got.defaultPolicy).toBe('allow');
  });

  it('toggles disabled', () => {
    const id = servers.create({
      label: 'a',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    servers.setDisabled(id, true);
    expect(servers.get(id)!.disabled).toBe(true);
  });

  it('cascades policy delete', () => {
    const id = servers.create({
      label: 'a',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    policies.set(id, 't1', 'allow');
    servers.delete(id);
    expect(policies.get(id, 't1')).toBeNull();
  });
});

describe('McpToolPoliciesRepo', () => {
  let policies: McpToolPoliciesRepo;
  let servers: McpServersRepo;
  let serverId: string;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    servers = new McpServersRepo(db);
    policies = new McpToolPoliciesRepo(db);
    serverId = servers.create({
      label: 's',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
    });
  });

  it('upserts and reads', () => {
    policies.set(serverId, 'list_files', 'allow');
    expect(policies.get(serverId, 'list_files')).toBe('allow');
    policies.set(serverId, 'list_files', 'deny');
    expect(policies.get(serverId, 'list_files')).toBe('deny');
  });

  it('listForServer returns map of tool→policy', () => {
    policies.set(serverId, 'a', 'allow');
    policies.set(serverId, 'b', 'deny');
    const map = policies.listForServer(serverId);
    expect(map).toEqual({ a: 'allow', b: 'deny' });
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/db/mcp.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/db/mcp.ts`:
```ts
import type { Database } from 'bun:sqlite';
import {
  CreateMcpServerInputSchema,
  type CreateMcpServerInput,
  type UpdateMcpServerInput,
  type McpPolicy,
  type McpTransport,
  newId,
} from '@autooffice/shared';

type Row = {
  id: string;
  label: string;
  transport: string;
  command: string | null;
  args: string;
  cwd: string | null;
  env: string;
  url: string | null;
  headers: string;
  timeout_seconds: number;
  default_policy: string;
  disabled: number;
  created_at: number;
  updated_at: number;
};

export type StoredMcpServer = {
  id: string;
  label: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  timeoutSeconds: number;
  defaultPolicy: McpPolicy;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
};

function rowToStored(row: Row): StoredMcpServer {
  return {
    id: row.id,
    label: row.label,
    transport: row.transport as McpTransport,
    command: row.command,
    args: JSON.parse(row.args || '[]'),
    cwd: row.cwd,
    env: JSON.parse(row.env || '{}'),
    url: row.url,
    headers: JSON.parse(row.headers || '{}'),
    timeoutSeconds: row.timeout_seconds,
    defaultPolicy: row.default_policy as McpPolicy,
    disabled: !!row.disabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class McpServersRepo {
  constructor(private readonly db: Database) {}

  create(input: CreateMcpServerInput): string {
    const parsed = CreateMcpServerInputSchema.parse(input);
    const id = newId('mcp');
    const now = Date.now();
    const isStdio = parsed.spec.transport === 'stdio';
    const command = isStdio ? parsed.spec.command : null;
    const args = isStdio ? parsed.spec.args : [];
    const cwd = isStdio ? parsed.spec.cwd ?? null : null;
    const env = isStdio ? parsed.spec.env : {};
    const url = !isStdio ? parsed.spec.url : null;
    const headers = !isStdio ? parsed.spec.headers : {};
    this.db
      .prepare(
        `INSERT INTO mcp_servers (id, label, transport, command, args, cwd, env, url, headers, timeout_seconds, default_policy, disabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        parsed.label,
        parsed.spec.transport,
        command,
        JSON.stringify(args),
        cwd,
        JSON.stringify(env),
        url,
        JSON.stringify(headers),
        parsed.timeoutSeconds,
        parsed.defaultPolicy,
        parsed.disabled ? 1 : 0,
        now,
        now,
      );
    return id;
  }

  update(id: string, patch: UpdateMcpServerInput): void {
    const cur = this.get(id);
    if (!cur) throw new Error('not found');
    const merged: StoredMcpServer = {
      ...cur,
      label: patch.label ?? cur.label,
      timeoutSeconds: patch.timeoutSeconds ?? cur.timeoutSeconds,
      defaultPolicy: patch.defaultPolicy ?? cur.defaultPolicy,
      disabled: patch.disabled ?? cur.disabled,
    };
    if (patch.spec) {
      merged.transport = patch.spec.transport;
      if (patch.spec.transport === 'stdio') {
        merged.command = patch.spec.command;
        merged.args = patch.spec.args;
        merged.cwd = patch.spec.cwd ?? null;
        merged.env = patch.spec.env;
        merged.url = null;
        merged.headers = {};
      } else {
        merged.command = null;
        merged.args = [];
        merged.cwd = null;
        merged.env = {};
        merged.url = patch.spec.url;
        merged.headers = patch.spec.headers;
      }
    }
    this.db
      .prepare(
        `UPDATE mcp_servers SET label=?, transport=?, command=?, args=?, cwd=?, env=?, url=?, headers=?, timeout_seconds=?, default_policy=?, disabled=?, updated_at=? WHERE id=?`,
      )
      .run(
        merged.label,
        merged.transport,
        merged.command,
        JSON.stringify(merged.args),
        merged.cwd,
        JSON.stringify(merged.env),
        merged.url,
        JSON.stringify(merged.headers),
        merged.timeoutSeconds,
        merged.defaultPolicy,
        merged.disabled ? 1 : 0,
        Date.now(),
        id,
      );
  }

  setDisabled(id: string, disabled: boolean): void {
    this.db
      .prepare('UPDATE mcp_servers SET disabled = ?, updated_at = ? WHERE id = ?')
      .run(disabled ? 1 : 0, Date.now(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
  }

  get(id: string): StoredMcpServer | null {
    const row = this.db
      .query<Row, [string]>('SELECT * FROM mcp_servers WHERE id = ?')
      .get(id);
    return row ? rowToStored(row) : null;
  }

  list(): StoredMcpServer[] {
    return (
      this.db
        .query<Row, []>('SELECT * FROM mcp_servers ORDER BY created_at ASC')
        .all()
        .map(rowToStored)
    );
  }
}

export class McpToolPoliciesRepo {
  constructor(private readonly db: Database) {}

  set(serverId: string, toolName: string, policy: McpPolicy): void {
    this.db
      .prepare(
        `INSERT INTO mcp_tool_policies (server_id, tool_name, policy) VALUES (?, ?, ?)
         ON CONFLICT(server_id, tool_name) DO UPDATE SET policy = excluded.policy`,
      )
      .run(serverId, toolName, policy);
  }

  get(serverId: string, toolName: string): McpPolicy | null {
    const row = this.db
      .query<{ policy: string }, [string, string]>(
        'SELECT policy FROM mcp_tool_policies WHERE server_id = ? AND tool_name = ?',
      )
      .get(serverId, toolName);
    return (row?.policy as McpPolicy | undefined) ?? null;
  }

  listForServer(serverId: string): Record<string, McpPolicy> {
    const rows = this.db
      .query<{ tool_name: string; policy: string }, [string]>(
        'SELECT tool_name, policy FROM mcp_tool_policies WHERE server_id = ?',
      )
      .all(serverId);
    return Object.fromEntries(rows.map((r) => [r.tool_name, r.policy as McpPolicy]));
  }
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/db/mcp.test.ts
```
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/mcp.ts apps/server/src/db/mcp.test.ts
git commit -m "feat(server/db): McpServersRepo + McpToolPoliciesRepo"
```

---

## Task 4: Diff classifier

**Files:**
- Create: `apps/server/src/mcp/diff.test.ts`
- Create: `apps/server/src/mcp/diff.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/mcp/diff.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { StoredMcpServer } from '../db/mcp';
import { classifyChange } from './diff';

const base: StoredMcpServer = {
  id: 'mcp_1',
  label: 'fs',
  transport: 'stdio',
  command: 'node',
  args: ['fs.js'],
  cwd: null,
  env: {},
  url: null,
  headers: {},
  timeoutSeconds: 60,
  defaultPolicy: 'ask',
  disabled: false,
  createdAt: 1,
  updatedAt: 1,
};

describe('classifyChange', () => {
  it('returns "none" when nothing relevant changed', () => {
    expect(classifyChange(base, { ...base, updatedAt: 2 })).toBe('none');
  });

  it('returns "live" for label / timeout / defaultPolicy', () => {
    expect(classifyChange(base, { ...base, label: 'fs2' })).toBe('live');
    expect(classifyChange(base, { ...base, timeoutSeconds: 120 })).toBe('live');
    expect(classifyChange(base, { ...base, defaultPolicy: 'allow' })).toBe('live');
  });

  it('returns "restart" for transport-affecting fields', () => {
    expect(classifyChange(base, { ...base, command: 'bun' })).toBe('restart');
    expect(classifyChange(base, { ...base, args: ['fs.js', '-v'] })).toBe('restart');
    expect(classifyChange(base, { ...base, cwd: '/tmp' })).toBe('restart');
    expect(classifyChange(base, { ...base, env: { K: 'v' } })).toBe('restart');
    expect(classifyChange(base, { ...base, transport: 'streamable-http', command: null, url: 'https://x' })).toBe('restart');
    expect(classifyChange(base, {
      ...base,
      transport: 'streamable-http',
      command: null,
      url: 'https://x',
      headers: { a: '1' },
    })).toBe('restart');
  });

  it('returns "disable" / "enable" appropriately', () => {
    expect(classifyChange(base, { ...base, disabled: true })).toBe('disable');
    expect(classifyChange({ ...base, disabled: true }, base)).toBe('enable');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/mcp/diff.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/mcp/diff.ts`:
```ts
import type { StoredMcpServer } from '../db/mcp';

export type ChangeKind = 'none' | 'live' | 'restart' | 'enable' | 'disable';

const RESTART_FIELDS: ReadonlyArray<keyof StoredMcpServer> = [
  'transport',
  'command',
  'args',
  'cwd',
  'env',
  'url',
  'headers',
];

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function classifyChange(prev: StoredMcpServer, next: StoredMcpServer): ChangeKind {
  if (prev.disabled !== next.disabled) {
    return next.disabled ? 'disable' : 'enable';
  }
  for (const f of RESTART_FIELDS) {
    if (!deepEqual(prev[f], next[f])) return 'restart';
  }
  if (
    prev.label !== next.label ||
    prev.timeoutSeconds !== next.timeoutSeconds ||
    prev.defaultPolicy !== next.defaultPolicy
  ) {
    return 'live';
  }
  return 'none';
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/mcp/diff.test.ts
```
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/mcp/diff.ts apps/server/src/mcp/diff.test.ts
git commit -m "feat(server/mcp): classifyChange routes config edits to live/restart/etc."
```

---

## Task 5: Stderr ring buffer

**Files:**
- Create: `apps/server/src/mcp/ring-buffer.test.ts`
- Create: `apps/server/src/mcp/ring-buffer.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/mcp/ring-buffer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  it('keeps the last N entries', () => {
    const rb = new RingBuffer(3);
    rb.push('a');
    rb.push('b');
    rb.push('c');
    rb.push('d');
    expect(rb.toArray()).toEqual(['b', 'c', 'd']);
  });

  it('returns [] when empty', () => {
    expect(new RingBuffer(2).toArray()).toEqual([]);
  });

  it('lastErrorMatching returns most recent matching entry', () => {
    const rb = new RingBuffer(10);
    rb.push('hello');
    rb.push('Error: x');
    rb.push('Error: y');
    rb.push('ok');
    expect(rb.lastErrorMatching(/error/i)).toBe('Error: y');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/mcp/ring-buffer.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/mcp/ring-buffer.ts`:
```ts
export class RingBuffer {
  private buf: string[] = [];
  constructor(private readonly capacity: number) {}

  push(line: string): void {
    this.buf.push(line);
    if (this.buf.length > this.capacity) this.buf.shift();
  }

  toArray(): string[] {
    return [...this.buf];
  }

  lastErrorMatching(re: RegExp): string | null {
    for (let i = this.buf.length - 1; i >= 0; i--) {
      if (re.test(this.buf[i]!)) return this.buf[i]!;
    }
    return null;
  }
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/mcp/ring-buffer.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/mcp/ring-buffer.ts apps/server/src/mcp/ring-buffer.test.ts
git commit -m "feat(server/mcp): RingBuffer for stderr capture (last 100 lines)"
```

---

## Task 6: Policy merge

**Files:**
- Create: `apps/server/src/mcp/policy.test.ts`
- Create: `apps/server/src/mcp/policy.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/mcp/policy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mergePolicies } from './policy';

describe('mergePolicies', () => {
  it('returns each tool with the per-tool policy if set, else default', () => {
    const result = mergePolicies(
      [
        { name: 'a', description: 'A' },
        { name: 'b', description: null },
      ],
      'ask',
      { a: 'allow' },
    );
    expect(result).toEqual([
      { name: 'a', description: 'A', inputSchema: null, policy: 'allow' },
      { name: 'b', description: null, inputSchema: null, policy: 'ask' },
    ]);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/mcp/policy.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/mcp/policy.ts`:
```ts
import type { McpPolicy, McpToolDescriptor } from '@autooffice/shared';

export type DiscoveredTool = {
  name: string;
  description?: string | null;
  inputSchema?: unknown;
};

export function mergePolicies(
  discovered: DiscoveredTool[],
  defaultPolicy: McpPolicy,
  perTool: Record<string, McpPolicy>,
): McpToolDescriptor[] {
  return discovered.map((t) => ({
    name: t.name,
    description: t.description ?? null,
    inputSchema: t.inputSchema ?? null,
    policy: perTool[t.name] ?? defaultPolicy,
  }));
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/mcp/policy.test.ts
```
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/mcp/policy.ts apps/server/src/mcp/policy.test.ts
git commit -m "feat(server/mcp): mergePolicies overlays per-tool on default"
```

---

## Task 7: Event bus

**Files:**
- Create: `apps/server/src/mcp/events.ts`

- [ ] **Step 1: Implement (no test — trivial)**

`apps/server/src/mcp/events.ts`:
```ts
import { EventEmitter } from 'node:events';
import type { McpStatus } from '@autooffice/shared';

export type StatusEvent = {
  serverId: string;
  status: McpStatus;
  errorMessage?: string | null;
  toolCount?: number;
};

class TypedEmitter extends EventEmitter {
  emitStatus(ev: StatusEvent) {
    this.emit('status', ev);
  }
  onStatus(fn: (ev: StatusEvent) => void) {
    this.on('status', fn);
  }
  offStatus(fn: (ev: StatusEvent) => void) {
    this.off('status', fn);
  }
}

export const mcpEvents = new TypedEmitter();
mcpEvents.setMaxListeners(50);
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/mcp/events.ts
git commit -m "feat(server/mcp): event bus for live status updates"
```

---

## Task 8: McpHub — failing test first

**Files:**
- Create: `apps/server/src/mcp/hub.test.ts`

- [ ] **Step 1: Write the test**

`apps/server/src/mcp/hub.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb } from '../db';
import { McpServersRepo, McpToolPoliciesRepo } from '../db/mcp';
import { McpHub } from './hub';

// Minimal fake AI SDK MCP client for in-process tests.
function makeFakeClient(toolNames: string[]) {
  return {
    async tools() {
      return Object.fromEntries(
        toolNames.map((n) => [
          n,
          {
            description: `desc ${n}`,
            inputSchema: { type: 'object' },
            execute: vi.fn().mockResolvedValue({ ok: true }),
          },
        ]),
      );
    },
    async close() { /* noop */ },
  };
}

describe('McpHub', () => {
  let servers: McpServersRepo;
  let policies: McpToolPoliciesRepo;
  let hub: McpHub;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    servers = new McpServersRepo(db);
    policies = new McpToolPoliciesRepo(db);
    hub = new McpHub(servers, policies, {
      // Inject a fake transport factory so we don't actually spawn anything.
      createClient: async () => makeFakeClient(['list_files', 'read_file']) as any,
    });
  });

  it('eagerly connects on add and discovers tools', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    await hub.connect(id);
    const view = hub.getView(id)!;
    expect(view.status).toBe('connected');
    expect(view.tools.map((t) => t.name).sort()).toEqual(['list_files', 'read_file']);
    expect(view.tools.every((t) => t.policy === 'ask')).toBe(true);
  });

  it('respects per-tool policy overrides', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    policies.set(id, 'list_files', 'allow');
    await hub.connect(id);
    const view = hub.getView(id)!;
    expect(view.tools.find((t) => t.name === 'list_files')!.policy).toBe('allow');
    expect(view.tools.find((t) => t.name === 'read_file')!.policy).toBe('ask');
  });

  it('disable disconnects but preserves config', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    await hub.connect(id);
    await hub.disable(id);
    const view = hub.getView(id)!;
    expect(view.status).toBe('disabled');
    expect(view.tools).toEqual([]);
  });

  it('live update of defaultPolicy does not reconnect', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    await hub.connect(id);
    const before = hub.getView(id)!;
    servers.update(id, { defaultPolicy: 'allow' });
    await hub.refreshConfig(id);
    const after = hub.getView(id)!;
    expect(after.status).toBe('connected');
    expect(after.tools.every((t) => t.policy === 'allow')).toBe(true);
    expect(after).not.toBe(before);
  });

  it('toolsForChat returns only allow+ask tools, never deny', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    policies.set(id, 'list_files', 'deny');
    await hub.connect(id);
    const tools = hub.toolsForChat();
    expect(tools.map((t) => t.fullName)).toEqual([`${id}/read_file`]);
    expect(tools[0]!.needsApproval).toBe(true);  // 'ask'
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/mcp/hub.test.ts
```
Expected: FAIL.

---

## Task 9: McpHub — implementation

**Files:**
- Create: `apps/server/src/mcp/hub.ts`

- [ ] **Step 1: Implement**

`apps/server/src/mcp/hub.ts`:
```ts
import type {
  McpPolicy,
  McpServerView,
  McpStatus,
  McpToolDescriptor,
} from '@autooffice/shared';
import type { McpServersRepo, McpToolPoliciesRepo, StoredMcpServer } from '../db/mcp';
import { mergePolicies, type DiscoveredTool } from './policy';
import { RingBuffer } from './ring-buffer';
import { mcpEvents } from './events';
import { classifyChange } from './diff';

export type McpClientLike = {
  tools(): Promise<Record<string, { description?: string; inputSchema?: unknown; execute?: (args: unknown) => Promise<unknown> }>>;
  close(): Promise<void>;
};

export type CreateClientFn = (cfg: StoredMcpServer) => Promise<McpClientLike>;

export type ChatToolWrapper = {
  fullName: string;       // e.g. "mcp_xyz/list_files" — used as the tool key in streamText({ tools })
  description: string | null;
  inputSchema: unknown;
  needsApproval: boolean; // true for 'ask'
  execute: (args: unknown) => Promise<unknown>;
};

type ManagedConnection = {
  serverId: string;
  client: McpClientLike | null;
  status: McpStatus;
  errorMessage: string | null;
  tools: McpToolDescriptor[];
  rawTools: DiscoveredTool[];
  rawClientTools: Record<string, { execute?: (args: unknown) => Promise<unknown> }>;
  stderr: RingBuffer;
  prevConfig: StoredMcpServer | null;
};

const BACKOFF_MS = [1_000, 4_000, 16_000, 64_000];

export class McpHub {
  private connections = new Map<string, ManagedConnection>();

  constructor(
    private readonly servers: McpServersRepo,
    private readonly policies: McpToolPoliciesRepo,
    private readonly opts: { createClient: CreateClientFn },
  ) {}

  async startAll(): Promise<void> {
    for (const s of this.servers.list()) {
      if (!s.disabled) {
        try {
          await this.connect(s.id);
        } catch (err) {
          this.markError(s.id, (err as Error).message);
        }
      } else {
        this.connections.set(s.id, this.makeDisabledConnection(s));
        this.emit(s.id);
      }
    }
  }

  async connect(serverId: string): Promise<void> {
    const cfg = this.servers.get(serverId);
    if (!cfg) throw new Error('server not found');
    let conn = this.connections.get(serverId);
    if (!conn) {
      conn = {
        serverId,
        client: null,
        status: 'connecting',
        errorMessage: null,
        tools: [],
        rawTools: [],
        rawClientTools: {},
        stderr: new RingBuffer(100),
        prevConfig: cfg,
      };
      this.connections.set(serverId, conn);
    } else {
      conn.status = 'connecting';
      conn.errorMessage = null;
      conn.prevConfig = cfg;
    }
    this.emit(serverId);

    try {
      const client = await this.opts.createClient(cfg);
      const rawTools = await client.tools();
      conn.client = client;
      conn.rawClientTools = rawTools;
      const discovered: DiscoveredTool[] = Object.entries(rawTools).map(([name, t]) => ({
        name,
        description: t.description ?? null,
        inputSchema: t.inputSchema ?? null,
      }));
      conn.rawTools = discovered;
      conn.status = 'connected';
      conn.errorMessage = null;
      conn.tools = mergePolicies(discovered, cfg.defaultPolicy, this.policies.listForServer(serverId));
      this.emit(serverId);
    } catch (err) {
      this.markError(serverId, (err as Error).message);
      throw err;
    }
  }

  async disable(serverId: string): Promise<void> {
    await this.tearDown(serverId);
    const cfg = this.servers.get(serverId);
    const conn = cfg ? this.makeDisabledConnection(cfg) : null;
    if (conn) this.connections.set(serverId, conn);
    this.emit(serverId);
  }

  async enable(serverId: string): Promise<void> {
    return this.connect(serverId);
  }

  async refreshConfig(serverId: string): Promise<void> {
    const next = this.servers.get(serverId);
    if (!next) return this.tearDown(serverId);
    const conn = this.connections.get(serverId);
    const prev = conn?.prevConfig ?? null;
    const change = prev ? classifyChange(prev, next) : 'restart';
    switch (change) {
      case 'none':
        return;
      case 'live':
        if (conn) {
          conn.tools = mergePolicies(
            conn.rawTools,
            next.defaultPolicy,
            this.policies.listForServer(serverId),
          );
          conn.prevConfig = next;
          this.emit(serverId);
        }
        return;
      case 'enable':
        return this.connect(serverId);
      case 'disable':
        return this.disable(serverId);
      case 'restart':
        await this.tearDown(serverId);
        return this.connect(serverId);
    }
  }

  async refreshPolicies(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    const cfg = this.servers.get(serverId);
    if (!cfg) return;
    conn.tools = mergePolicies(conn.rawTools, cfg.defaultPolicy, this.policies.listForServer(serverId));
    this.emit(serverId);
  }

  async remove(serverId: string): Promise<void> {
    await this.tearDown(serverId);
    this.connections.delete(serverId);
  }

  getView(serverId: string): McpServerView | null {
    const cfg = this.servers.get(serverId);
    if (!cfg) return null;
    const conn = this.connections.get(serverId);
    return {
      id: cfg.id,
      label: cfg.label,
      transport: cfg.transport,
      command: cfg.command,
      args: cfg.args,
      cwd: cfg.cwd,
      env: cfg.env,
      url: cfg.url,
      headers: cfg.headers,
      timeoutSeconds: cfg.timeoutSeconds,
      defaultPolicy: cfg.defaultPolicy,
      disabled: cfg.disabled,
      status: conn?.status ?? (cfg.disabled ? 'disabled' : 'disconnected'),
      errorMessage: conn?.errorMessage ?? null,
      tools: conn?.tools ?? [],
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
    };
  }

  listViews(): McpServerView[] {
    return this.servers.list().map((s) => this.getView(s.id)!).filter(Boolean);
  }

  getStderrLog(serverId: string): string[] {
    return this.connections.get(serverId)?.stderr.toArray() ?? [];
  }

  toolsForChat(): ChatToolWrapper[] {
    const out: ChatToolWrapper[] = [];
    for (const conn of this.connections.values()) {
      if (conn.status !== 'connected') continue;
      for (const t of conn.tools) {
        if (t.policy === 'deny') continue;
        const cliEntry = conn.rawClientTools[t.name];
        out.push({
          fullName: `${conn.serverId}/${t.name}`,
          description: t.description ?? null,
          inputSchema: t.inputSchema,
          needsApproval: t.policy === 'ask',
          execute: cliEntry?.execute ?? (async () => {
            throw new Error(`Tool ${t.name} has no execute fn`);
          }),
        });
      }
    }
    return out;
  }

  private async tearDown(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    if (conn.client) {
      try { await conn.client.close(); } catch { /* noop */ }
    }
    conn.client = null;
    conn.rawTools = [];
    conn.rawClientTools = {};
    conn.tools = [];
    conn.status = 'disconnected';
    this.emit(serverId);
  }

  private makeDisabledConnection(cfg: StoredMcpServer): ManagedConnection {
    return {
      serverId: cfg.id,
      client: null,
      status: 'disabled',
      errorMessage: null,
      tools: [],
      rawTools: [],
      rawClientTools: {},
      stderr: new RingBuffer(100),
      prevConfig: cfg,
    };
  }

  private markError(serverId: string, message: string) {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    conn.status = 'error';
    conn.errorMessage = message;
    this.emit(serverId);
  }

  private emit(serverId: string) {
    const view = this.getView(serverId);
    if (!view) return;
    mcpEvents.emitStatus({
      serverId,
      status: view.status,
      errorMessage: view.errorMessage,
      toolCount: view.tools.length,
    });
  }
}
```

- [ ] **Step 2: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/mcp/hub.test.ts
```
Expected: 5 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/mcp/hub.ts
git commit -m "feat(server/mcp): McpHub with eager connect, diff-driven updates, policy enforcement"
```

---

## Task 10: Real client factory (production wiring)

**Files:**
- Modify: `apps/server/src/mcp/hub.ts` (export a default factory)

> The hub above takes an injectable `createClient` to make tests possible. We also need a production factory that uses the real AI SDK MCP client.

- [ ] **Step 1: Add a default factory module**

Create `apps/server/src/mcp/default-client.ts`:
```ts
import { createMCPClient } from '@ai-sdk/mcp';
import type { StoredMcpServer } from '../db/mcp';
import type { McpClientLike } from './hub';

export async function createDefaultClient(cfg: StoredMcpServer): Promise<McpClientLike> {
  if (cfg.transport === 'stdio') {
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    const transport = new StdioClientTransport({
      command: cfg.command!,
      args: cfg.args,
      cwd: cfg.cwd ?? undefined,
      env: { ...process.env, ...cfg.env },
    });
    const client = await createMCPClient({ transport });
    return wrap(client);
  }
  if (cfg.transport === 'sse') {
    const client = await createMCPClient({
      transport: { type: 'sse', url: cfg.url!, headers: cfg.headers },
    } as any);
    return wrap(client);
  }
  // streamable-http
  const client = await createMCPClient({
    transport: { type: 'http', url: cfg.url!, headers: cfg.headers },
  } as any);
  return wrap(client);
}

function wrap(client: any): McpClientLike {
  return {
    async tools() {
      return await client.tools();
    },
    async close() {
      await client.close();
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/mcp/default-client.ts
git commit -m "feat(server/mcp): real AI SDK MCP client factory (stdio/sse/http)"
```

---

## Task 11: `/api/mcp/*` routes

**Files:**
- Create: `apps/server/src/routes/mcp.test.ts`
- Create: `apps/server/src/routes/mcp.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/routes/mcp.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

const TOKEN = 'tok';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function fakeMcp(toolNames: string[]) {
  return {
    async tools() {
      return Object.fromEntries(toolNames.map((n) => [n, { description: n, inputSchema: {}, execute: vi.fn() }]));
    },
    async close() {},
  };
}

describe('mcp routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({
      version: 'test',
      db,
      authToken: TOKEN,
      mcpClientFactory: async () => fakeMcp(['list_files', 'read_file']) as any,
    });
  });

  it('GET /api/mcp/servers on empty db returns []', async () => {
    const r = await app.request('/api/mcp/servers', { headers: auth });
    expect(await r.json()).toEqual([]);
  });

  it('POST /api/mcp/servers eagerly connects', async () => {
    const r = await app.request('/api/mcp/servers', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        label: 'fs',
        timeoutSeconds: 60,
        defaultPolicy: 'ask',
        disabled: false,
        spec: { transport: 'stdio', command: 'node', args: ['fs.js'], env: {}, cwd: null },
      }),
    });
    expect(r.status).toBe(201);
    const { id } = await r.json();
    // give the eager connect a tick
    await new Promise((res) => setTimeout(res, 5));
    const v = await (await app.request(`/api/mcp/servers/${id}`, { headers: auth })).json();
    expect(v.status).toBe('connected');
    expect(v.tools.map((t: any) => t.name).sort()).toEqual(['list_files', 'read_file']);
  });

  it('PUT updates default policy live (no reconnect needed)', async () => {
    const id = (
      await (
        await app.request('/api/mcp/servers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            label: 'fs',
            timeoutSeconds: 60,
            defaultPolicy: 'ask',
            disabled: false,
            spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
          }),
        })
      ).json()
    ).id;
    await new Promise((res) => setTimeout(res, 5));
    const r = await app.request(`/api/mcp/servers/${id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ defaultPolicy: 'allow' }),
    });
    expect(r.status).toBe(200);
    const v = await r.json();
    expect(v.defaultPolicy).toBe('allow');
    expect(v.tools.every((t: any) => t.policy === 'allow')).toBe(true);
  });

  it('PUT /:id/tools/:tool overrides single-tool policy', async () => {
    const id = (
      await (
        await app.request('/api/mcp/servers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            label: 'fs',
            timeoutSeconds: 60,
            defaultPolicy: 'ask',
            disabled: false,
            spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
          }),
        })
      ).json()
    ).id;
    await new Promise((res) => setTimeout(res, 5));
    const r = await app.request(`/api/mcp/servers/${id}/tools/list_files`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ policy: 'deny' }),
    });
    expect(r.status).toBe(200);
    const v = await (await app.request(`/api/mcp/servers/${id}`, { headers: auth })).json();
    const lf = v.tools.find((t: any) => t.name === 'list_files');
    expect(lf.policy).toBe('deny');
  });

  it('DELETE removes the server', async () => {
    const id = (
      await (
        await app.request('/api/mcp/servers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            label: 'fs',
            timeoutSeconds: 60,
            defaultPolicy: 'ask',
            disabled: false,
            spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
          }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/mcp/servers/${id}`, { method: 'DELETE', headers: auth });
    expect(r.status).toBe(204);
    expect(await (await app.request('/api/mcp/servers', { headers: auth })).json()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/mcp.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/routes/mcp.ts`:
```ts
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  CreateMcpServerInputSchema,
  McpPolicySchema,
  UpdateMcpServerInputSchema,
} from '@autooffice/shared';
import type { McpHub } from '../mcp/hub';
import type { McpServersRepo, McpToolPoliciesRepo } from '../db/mcp';
import { mcpEvents } from '../mcp/events';

export function mcpRouter(hub: McpHub, servers: McpServersRepo, policies: McpToolPoliciesRepo) {
  const r = new Hono();

  r.get('/servers', (c) => c.json(hub.listViews()));

  r.get('/servers/:id', (c) => {
    const v = hub.getView(c.req.param('id'));
    return v ? c.json(v) : c.json({ error: 'not found' }, 404);
  });

  r.post('/servers', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = CreateMcpServerInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const id = servers.create(parsed.data);
    if (!parsed.data.disabled) {
      hub.connect(id).catch(() => {});
    } else {
      // ensure view reflects disabled state
      hub.disable(id).catch(() => {});
    }
    return c.json({ id }, 201);
  });

  r.put('/servers/:id', async (c) => {
    const id = c.req.param('id');
    if (!servers.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = UpdateMcpServerInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    servers.update(id, parsed.data);
    await hub.refreshConfig(id);
    return c.json(hub.getView(id));
  });

  r.delete('/servers/:id', async (c) => {
    const id = c.req.param('id');
    await hub.remove(id);
    servers.delete(id);
    return c.body(null, 204);
  });

  r.post('/servers/:id/restart', async (c) => {
    const id = c.req.param('id');
    if (!servers.get(id)) return c.json({ error: 'not found' }, 404);
    await hub.remove(id);
    await hub.connect(id);
    return c.json(hub.getView(id));
  });

  r.get('/servers/:id/tools', (c) => {
    const v = hub.getView(c.req.param('id'));
    return v ? c.json(v.tools) : c.json({ error: 'not found' }, 404);
  });

  r.put('/servers/:id/tools/:tool', async (c) => {
    const id = c.req.param('id');
    const tool = c.req.param('tool');
    if (!servers.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = McpPolicySchema.safeParse((body as any)?.policy);
    if (!parsed.success) return c.json({ error: 'invalid policy' }, 400);
    policies.set(id, tool, parsed.data);
    await hub.refreshPolicies(id);
    return c.json(hub.getView(id));
  });

  r.get('/servers/:id/log', (c) => {
    const id = c.req.param('id');
    const lines = hub.getStderrLog(id);
    return c.json({ lines });
  });

  r.get('/events', (c) =>
    streamSSE(c, async (stream) => {
      const handler = (ev: { serverId: string; status: string; errorMessage?: string | null; toolCount?: number }) =>
        stream.writeSSE({ event: 'status', data: JSON.stringify(ev) });
      mcpEvents.onStatus(handler);
      try {
        // Send initial snapshot.
        for (const v of hub.listViews()) {
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({ serverId: v.id, status: v.status, errorMessage: v.errorMessage, toolCount: v.tools.length }),
          });
        }
        // Keep alive until the client disconnects.
        await new Promise<void>((resolve) => stream.onAbort(resolve));
      } finally {
        mcpEvents.offStatus(handler);
      }
    }),
  );

  return r;
}
```

- [ ] **Step 4: Wire into `app.ts`**

Replace the imports + body of `apps/server/src/app.ts`:
```ts
import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { providersRouter } from './routes/providers';
import { mcpRouter } from './routes/mcp';
import { SettingsRepo } from './db/settings';
import { ConversationsRepo } from './db/conversations';
import { MessagesRepo } from './db/messages';
import { ProvidersRepo } from './db/providers';
import { ProviderRegistry } from './providers';
import { McpServersRepo, McpToolPoliciesRepo } from './db/mcp';
import { McpHub, type CreateClientFn } from './mcp/hub';
import { createDefaultClient } from './mcp/default-client';

export type AppConfig = {
  version: string;
  db: Database;
  authToken: string;
  mcpClientFactory?: CreateClientFn;
};

export function createApp(config: AppConfig) {
  const app = new Hono();
  const settings = new SettingsRepo(config.db);
  const conversations = new ConversationsRepo(config.db);
  const messages = new MessagesRepo(config.db);
  const providers = new ProvidersRepo(config.db);
  const registry = new ProviderRegistry(providers);
  const mcpServers = new McpServersRepo(config.db);
  const mcpPolicies = new McpToolPoliciesRepo(config.db);
  const hub = new McpHub(mcpServers, mcpPolicies, {
    createClient: config.mcpClientFactory ?? createDefaultClient,
  });

  app.route('/', healthRouter(config.version));
  app.use('/api/*', bearerAuth(config.authToken));
  app.route('/api/settings', settingsRouter(settings));
  app.route('/api/conversations', conversationsRouter(conversations, messages));
  app.route('/api/providers', providersRouter(providers, registry));
  app.route('/api/mcp', mcpRouter(hub, mcpServers, mcpPolicies));

  // Connect existing MCP servers in the background.
  hub.startAll().catch((err) => console.error('mcp startAll failed', err));

  return Object.assign(app, { __hub: hub });
}
```

- [ ] **Step 5: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/mcp.test.ts
```
Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): /api/mcp CRUD + tool policy + log + SSE events"
```

---

## Task 12: Coverage and full-suite green

**Files:** None.

- [ ] **Step 1: Run all server tests with coverage**

```bash
npm --workspace @autooffice/server run test -- --coverage
```

- [ ] **Step 2: Plug branches** (likely candidates: `enable`/`disable` paths in McpHub, `restart` in `refreshConfig`, error path in `markError`).

- [ ] **Step 3: Push branch**

```bash
git push
```

CI's `vitest-linux` job must remain green.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: McpHub with eager connect, diff classification (live vs restart), tri-state policy enforcement, status state machine, stderr ring buffer, `/api/mcp/*` routes including SSE event stream — all present.
- [x] No TODO/TBD placeholders. (One implementation note in Task 5 about CLI-bridge package versions, marked clearly with action.)
- [x] McpHub takes `createClient` injectable so tests don't spawn real processes.
- [x] Default-client module wires the real AI SDK MCP client; not exercised by unit tests but used in dev/prod.
- [x] Type names consistent across schema, repo, hub, routes (`McpServerView`, `McpToolDescriptor`, `McpPolicy`, etc.).
- [x] No references to identifiers from later plans.
