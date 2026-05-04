# Local full-stack — Plan 05: `/api/chat` + frontend `useChat` cutover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the agent loop over to the server. Implement `POST /api/chat` with `streamText`, tri-state-policy-filtered tools (built-in `lookup_skill` + `execute_code` + MCP tools), conversation persistence via `consumeStream()` + `onFinish`, and orphan-tool-call sweep. Replace the in-browser orchestrator with `useChat` from `@ai-sdk/react`, with `execute_code` running client-side via the iframe through `onToolCall`. Delete the old browser-side agent code.

**Architecture:** `/api/chat` accepts only the new (or regenerated) message plus conversation id; rebuilds full history from SQLite, sweeps orphan tool calls, builds the tool registry from `built-in tools + hub.toolsForChat()` with `needsApproval` mapped from the tri-state policy. `streamText` runs server-side; `result.consumeStream()` keeps the loop going if the client disconnects; `onFinish` saves the final `UIMessage[]` via `MessagesRepo.replaceAll`. Frontend `App.tsx` swaps the orchestrator for `useChat({ id, messages: initialMessages, transport })` with `prepareSendMessagesRequest` to send only the last message. `MessageBubble.tsx` gains parts-renderer cases for `text`, `step-start`, `tool-execute_code`, `tool-lookup_skill`, and `dynamic-tool`.

**Tech Stack:** AI SDK `streamText` + `convertToModelMessages` + `createIdGenerator` + `tool({ ... })` + `stepCountIs`, `@ai-sdk/react` `useChat` + `DefaultChatTransport` + `lastAssistantMessageIsCompleteWithToolCalls` + `lastAssistantMessageIsCompleteWithApprovalResponses`, vitest + RTL.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Backend API → POST /api/chat", "Frontend changes", "Conversation reload — no strict schema validation".

---

## File structure after this plan

```
apps/server/
├── src/
│   ├── app.ts                        MODIFIED (mount /api/chat + /bootstrap)
│   ├── tools/
│   │   ├── index.ts                  NEW (assemble built-ins + MCP)
│   │   ├── index.test.ts             NEW
│   │   ├── lookup_skill.ts           NEW (server-side execute)
│   │   └── execute_code.ts           NEW (client-side: schema only)
│   ├── routes/
│   │   ├── chat.ts                   NEW (POST /api/chat)
│   │   ├── chat.test.ts              NEW
│   │   ├── bootstrap.ts              NEW (GET /bootstrap, origin-gated)
│   │   └── bootstrap.test.ts         NEW
│   ├── chat/
│   │   ├── orphan-sweep.ts           NEW (heal dangling tool calls)
│   │   ├── orphan-sweep.test.ts      NEW
│   │   ├── system-prompt.ts          NEW (per-host)
│   │   └── system-prompt.test.ts     NEW
│   └── skills/                       NEW (moved from web)
│       └── …existing skill files…    MOVED

apps/web/
├── package.json                      MODIFIED (remove @ai-sdk/* server-only providers; add @ai-sdk/react if missing)
├── src/
│   └── taskpane/
│       ├── App.tsx                   MODIFIED (useChat + bootstrap)
│       ├── api.ts                    NEW (fetch wrappers + bootstrap)
│       ├── api.test.ts               NEW
│       ├── components/
│       │   ├── MessageBubble.tsx     MODIFIED (parts switch)
│       │   ├── parts/
│       │   │   ├── TextPart.tsx      NEW (extracted)
│       │   │   ├── StepStartPart.tsx NEW
│       │   │   ├── ExecuteCodePart.tsx NEW (approve/reject)
│       │   │   ├── LookupSkillPart.tsx NEW
│       │   │   ├── DynamicToolPart.tsx NEW
│       │   │   └── ApprovalRequestedPart.tsx NEW (server-side tool approvals)
│       │   └── parts/parts.test.tsx  NEW
│       ├── chat/
│       │   ├── transport.ts          NEW (DefaultChatTransport factory)
│       │   ├── on-tool-call.ts       NEW (client-side execute_code)
│       │   └── on-tool-call.test.ts  NEW
│       ├── agent/
│       │   ├── orchestrator.ts       DELETED
│       │   ├── tools.ts              DELETED
│       │   └── providers.ts          DELETED (already moved to server)
│       └── store/
│           └── settings.ts           DELETED (replaced by api.ts settings)
```

---

## Task 1: Move skills/ to server

**Files:**
- Move: `apps/web/src/taskpane/skills/` → `apps/server/src/skills/`

- [ ] **Step 1: Move with git**

```bash
git mv apps/web/src/taskpane/skills apps/server/src/skills
```

- [ ] **Step 2: Verify the registry imports compile under bun**

The skills registry in `apps/server/src/skills/index.ts` imports markdown files via Vite-ish glob or via fs. After the move it must use `node:fs` to read by name. Open `apps/server/src/skills/index.ts` and rewrite to:
```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILLS_DIR = dirname(fileURLToPath(import.meta.url));

export type SkillName = string;

export function listSkills(): SkillName[] {
  return readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

export function readSkill(name: SkillName): string | null {
  try {
    return readFileSync(join(SKILLS_DIR, `${name}.md`), 'utf8');
  } catch {
    return null;
  }
}
```

> **Note:** if the existing `skills/index.ts` exposed scoped-by-host helpers (Word vs Excel), preserve the names — likely something like `skillsForHost(host: Host): SkillName[]`. Re-create that with a small filter map. If you don't see one, skip — `lookup_skill` will accept any name.

- [ ] **Step 3: Sanity test — list returns the markdown files**

`apps/server/src/skills/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { listSkills, readSkill } from './index';

describe('skills registry', () => {
  it('lists at least one .md skill', () => {
    expect(listSkills().length).toBeGreaterThan(0);
  });
  it('reads a skill body', () => {
    const first = listSkills()[0]!;
    const body = readSkill(first);
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });
  it('returns null for unknown skill', () => {
    expect(readSkill('does_not_exist')).toBeNull();
  });
});
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/skills/index.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/skills apps/web/src/taskpane
git commit -m "refactor: move office.js skill markdown to server (read via node:fs)"
```

---

## Task 2: Built-in tool — `lookup_skill` (server-side)

**Files:**
- Create: `apps/server/src/tools/lookup_skill.ts`

- [ ] **Step 1: Implement**

`apps/server/src/tools/lookup_skill.ts`:
```ts
import { tool } from 'ai';
import { z } from 'zod';
import { listSkills, readSkill } from '../skills/index';

export function makeLookupSkillTool() {
  return tool({
    description: `Fetch office.js API documentation for a domain (e.g. "tables", "ranges", "formatting"). Use this BEFORE generating code that touches a domain you haven't read about in this conversation.`,
    inputSchema: z.object({ name: z.string().describe('The skill name. Call once per domain.') }),
    execute: async ({ name }) => {
      const body = readSkill(name);
      if (body == null) {
        return { error: `Unknown skill '${name}'. Available: ${listSkills().join(', ')}` };
      }
      return { name, body };
    },
  });
}
```

> **Note:** matches today's behavior of `lookup_skill`; the Word/Excel/PowerPoint scoping (filtering by host) is applied where this tool is *added* to the registry — see Task 4.

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/tools/lookup_skill.ts
git commit -m "feat(server/tools): lookup_skill (server-side execute via fs)"
```

---

## Task 3: Built-in tool — `execute_code` (client-side stub)

**Files:**
- Create: `apps/server/src/tools/execute_code.ts`

- [ ] **Step 1: Implement**

`apps/server/src/tools/execute_code.ts`:
```ts
import { tool } from 'ai';
import { z } from 'zod';

// Client-side tool: NO execute fn. The browser's onToolCall in useChat
// resolves it by running the code in the sandboxed iframe.
export function makeExecuteCodeTool() {
  return tool({
    description: `Execute JavaScript against the live Office document via the sandboxed iframe. The code receives an Office context and must call await context.sync(). Returns the function's return value or an error.`,
    inputSchema: z.object({ code: z.string().describe('JavaScript source. Must be a top-level body, not a function declaration.') }),
    // No execute → AI SDK forwards the call to the client.
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/tools/execute_code.ts
git commit -m "feat(server/tools): execute_code declared as client-side tool (no execute)"
```

---

## Task 4: Tool assembly + MCP wrapping with `needsApproval`

**Files:**
- Create: `apps/server/src/tools/index.test.ts`
- Create: `apps/server/src/tools/index.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/tools/index.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { assembleTools } from './index';
import type { ChatToolWrapper } from '../mcp/hub';

describe('assembleTools', () => {
  function chatTool(name: string, needsApproval: boolean): ChatToolWrapper {
    return {
      fullName: `mcp_x/${name}`,
      description: name,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      needsApproval,
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };
  }

  it('includes built-ins (lookup_skill server-side, execute_code client-side)', () => {
    const out = assembleTools({ host: 'word', mcpTools: [] });
    expect(out).toHaveProperty('lookup_skill');
    expect(out).toHaveProperty('execute_code');
    expect(typeof (out.lookup_skill as any).execute).toBe('function');
    expect((out.execute_code as any).execute).toBeUndefined();
  });

  it('includes MCP tools using their fullName as key', () => {
    const t = chatTool('list_files', false);
    const out = assembleTools({ host: 'word', mcpTools: [t] });
    expect(out['mcp_x/list_files']).toBeDefined();
  });

  it('marks ask-policy tools with needsApproval', () => {
    const t = chatTool('list_files', true);
    const out = assembleTools({ host: 'word', mcpTools: [t] });
    expect((out['mcp_x/list_files'] as any).needsApproval).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/tools/index.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/tools/index.ts`:
```ts
import { tool, type Tool } from 'ai';
import type { Host } from '@autooffice/shared';
import type { ChatToolWrapper } from '../mcp/hub';
import { makeLookupSkillTool } from './lookup_skill';
import { makeExecuteCodeTool } from './execute_code';

type ToolMap = Record<string, Tool<any, any>>;

export type AssembleArgs = {
  host: Host;
  mcpTools: ChatToolWrapper[];
};

export function assembleTools({ host: _host, mcpTools }: AssembleArgs): ToolMap {
  const out: ToolMap = {
    lookup_skill: makeLookupSkillTool(),
    execute_code: makeExecuteCodeTool(),
  };
  for (const m of mcpTools) {
    out[m.fullName] = tool({
      description: m.description ?? m.fullName,
      inputSchema: (m.inputSchema as any) ?? { type: 'object' },
      execute: async (input: unknown) => m.execute(input),
      needsApproval: m.needsApproval,
    } as any);
  }
  return out;
}
```

> **Note:** the `_host` parameter is unused for now — it's a hook for plan 09 / later (skill scoping). Keep it.

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/tools/index.test.ts
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/tools
git commit -m "feat(server/tools): assembleTools merges built-ins + MCP w/ needsApproval"
```

---

## Task 5: Orphan-call sweep

**Files:**
- Create: `apps/server/src/chat/orphan-sweep.test.ts`
- Create: `apps/server/src/chat/orphan-sweep.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/chat/orphan-sweep.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sweepOrphans } from './orphan-sweep';

describe('sweepOrphans', () => {
  it('passes through messages with no tool calls unchanged', () => {
    const msgs = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }];
    expect(sweepOrphans(msgs as any)).toEqual(msgs);
  });

  it('injects synthetic output for an assistant tool-call without a matching tool-result', () => {
    const msgs = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Calling tool' },
          {
            type: 'tool-execute_code',
            toolCallId: 'tc1',
            state: 'input-available',
            input: { code: 'x' },
          },
        ],
      },
    ];
    const out = sweepOrphans(msgs as any);
    const last = out[0].parts;
    expect(last).toHaveLength(2);
    expect((last[1] as any).state).toBe('output-error');
    expect((last[1] as any).errorText).toMatch(/not recorded/i);
  });

  it('leaves a tool-call alone when a matching output-available exists', () => {
    const msgs = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          { type: 'tool-execute_code', toolCallId: 'tc1', state: 'output-available', input: { code: 'x' }, output: { ok: true } },
        ],
      },
    ];
    expect(sweepOrphans(msgs as any)).toEqual(msgs);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/chat/orphan-sweep.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/server/src/chat/orphan-sweep.ts`:
```ts
type Part = Record<string, unknown> & { type: string };
type Msg = { id: string; role: string; parts: Part[] };

const TERMINAL_STATES = new Set(['output-available', 'output-error']);

export function sweepOrphans<T extends Msg>(messages: T[]): T[] {
  return messages.map((m) => {
    if (m.role !== 'assistant') return m;
    const parts = [...m.parts];
    let mutated = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const t = p.type as string;
      const isToolPart = t.startsWith('tool-') || t === 'dynamic-tool';
      if (!isToolPart) continue;
      const state = p.state as string | undefined;
      if (state && TERMINAL_STATES.has(state)) continue;
      // Promote to a synthetic error.
      parts[i] = {
        ...p,
        state: 'output-error',
        errorText: 'Tool result was not recorded (server restart or aborted turn).',
      };
      mutated = true;
    }
    if (!mutated) return m;
    return { ...m, parts };
  });
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/chat/orphan-sweep.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/orphan-sweep.ts apps/server/src/chat/orphan-sweep.test.ts
git commit -m "feat(server/chat): sweepOrphans heals dangling tool calls before convertToModelMessages"
```

---

## Task 6: System prompt

**Files:**
- Create: `apps/server/src/chat/system-prompt.test.ts`
- Create: `apps/server/src/chat/system-prompt.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/chat/system-prompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { systemPromptForHost } from './system-prompt';

describe('systemPromptForHost', () => {
  it('mentions Word for word host', () => {
    expect(systemPromptForHost('word')).toMatch(/Word/);
  });
  it('mentions Excel for excel host', () => {
    expect(systemPromptForHost('excel')).toMatch(/Excel/);
  });
  it('mentions PowerPoint for powerpoint host', () => {
    expect(systemPromptForHost('powerpoint')).toMatch(/PowerPoint/);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/chat/system-prompt.test.ts
```

- [ ] **Step 3: Implement**

`apps/server/src/chat/system-prompt.ts`:
```ts
import type { Host } from '@autooffice/shared';

const PER_HOST: Record<Host, string> = {
  word: 'You are AutoOffice, an AI assistant inside Microsoft Word. You help the user by generating and executing office.js code against the live document.',
  excel: 'You are AutoOffice, an AI assistant inside Microsoft Excel. You help the user by generating and executing office.js code against the live workbook.',
  powerpoint: 'You are AutoOffice, an AI assistant inside Microsoft PowerPoint. You help the user by generating and executing office.js code against the live presentation.',
};

const COMMON = `
Tools:
- lookup_skill(name): fetch office.js API documentation for a domain. Call once per domain you intend to use.
- execute_code(code): run JavaScript against the live document. The code's top-level body has \`context\` available; remember to await context.sync().
- MCP tools may also be available depending on the user's setup.

Guidelines:
- Look up skills before generating code for any office.js domain you're unsure about.
- Generate minimal, correct code. Self-heal on errors.
- Show user the code before running it (the UI handles approval).
`;

export function systemPromptForHost(host: Host): string {
  return `${PER_HOST[host]}\n${COMMON}`.trim();
}
```

- [ ] **Step 4: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/chat/system-prompt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/system-prompt.ts apps/server/src/chat/system-prompt.test.ts
git commit -m "feat(server/chat): per-host system prompt"
```

---

## Task 7: `/api/chat` route — failing test first

**Files:**
- Create: `apps/server/src/routes/chat.test.ts`

- [ ] **Step 1: Write the test (uses a stub LanguageModel)**

`apps/server/src/routes/chat.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';
import type { LanguageModel } from 'ai';

const TOKEN = 'tok';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// A toy LanguageModel that always emits a single text response.
function fakeModel(text: string): LanguageModel {
  return {
    specificationVersion: 'v2',
    provider: 'fake',
    modelId: 'fake-1',
    async doStream() {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't0' });
            controller.enqueue({ type: 'text-delta', id: 't0', delta: text });
            controller.enqueue({ type: 'text-end', id: 't0' });
            controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  } as unknown as LanguageModel;
}

describe('POST /api/chat', () => {
  let app: ReturnType<typeof createApp>;
  let convId: string;

  beforeEach(async () => {
    const db = openDb({ url: ':memory:' });
    app = createApp({
      version: 'test',
      db,
      authToken: TOKEN,
      mcpClientFactory: async () => ({ async tools() { return {}; }, async close() {} } as any),
      modelOverride: () => fakeModel('Hello from fake'),
    });
    const r = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ host: 'word' }),
    });
    convId = (await r.json()).id;
  });

  it('streams a UI message stream and persists messages', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        id: convId,
        host: 'word',
        providerId: 'p_unused',
        modelId: 'fake-1',
        trigger: 'submit-user-message',
        message: { id: 'msg_user_1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream|application\/json/);

    // drain the stream
    const reader = res.body!.getReader();
    let chunks = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks += new TextDecoder().decode(value);
    }
    expect(chunks).toContain('Hello from fake');

    // give onFinish a tick
    await new Promise((r) => setTimeout(r, 30));

    const conv = await (
      await app.request(`/api/conversations/${convId}`, { headers: auth })
    ).json();
    expect(conv.messages.length).toBeGreaterThanOrEqual(2);
    expect(conv.messages.at(-1).role).toBe('assistant');
  });

  it('returns 404 for unknown conversation', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        id: 'c_nope',
        host: 'word',
        providerId: 'p',
        modelId: 'fake-1',
        trigger: 'submit-user-message',
        message: { id: 'msg_x', role: 'user', parts: [{ type: 'text', text: 'x' }] },
      }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/chat.test.ts
```
Expected: FAIL.

---

## Task 8: `/api/chat` route — implementation

**Files:**
- Create: `apps/server/src/routes/chat.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Implement the route**

`apps/server/src/routes/chat.ts`:
```ts
import { Hono } from 'hono';
import { z } from 'zod';
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  createIdGenerator,
} from 'ai';
import type { LanguageModel } from 'ai';
import { HostSchema, type Host } from '@autooffice/shared';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';
import type { ProviderRegistry } from '../providers';
import type { McpHub } from '../mcp/hub';
import { sweepOrphans } from '../chat/orphan-sweep';
import { systemPromptForHost } from '../chat/system-prompt';
import { assembleTools } from '../tools';

const Body = z.object({
  id: z.string(),
  host: HostSchema,
  providerId: z.string(),
  modelId: z.string(),
  trigger: z.enum(['submit-user-message', 'regenerate-assistant-message']),
  message: z.any().optional(),
  messageId: z.string().optional(),
});

export type ChatDeps = {
  conversations: ConversationsRepo;
  messages: MessagesRepo;
  registry: ProviderRegistry;
  hub: McpHub;
  modelOverride?: (providerId: string, modelId: string) => LanguageModel;
};

export function chatRouter(deps: ChatDeps) {
  const r = new Hono();

  r.post('/', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = Body.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const { id, host, providerId, modelId, trigger, message, messageId } = parsed.data;

    const conv = deps.conversations.get(id);
    if (!conv) return c.json({ error: 'not found' }, 404);

    let model: LanguageModel;
    try {
      model = deps.modelOverride
        ? deps.modelOverride(providerId, modelId)
        : (await deps.registry.resolve(providerId, modelId))!;
      if (!model) return c.json({ error: 'provider not found' }, 400);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }

    // Pull current history; append new user message OR truncate to before regenerated message.
    const history = deps.messages.listByConversation(id);
    let merged: Array<{ id: string; role: string; parts: unknown[]; metadata: Record<string, unknown> | null; conversationId: string }>;
    if (trigger === 'submit-user-message' && message) {
      merged = [
        ...history,
        {
          id: message.id,
          role: message.role ?? 'user',
          parts: message.parts ?? [],
          metadata: message.metadata ?? null,
          conversationId: id,
        },
      ];
    } else if (trigger === 'regenerate-assistant-message' && messageId) {
      const idx = history.findIndex((m) => m.id === messageId);
      merged = idx >= 0 ? history.slice(0, idx) : history;
    } else {
      return c.json({ error: 'invalid trigger payload' }, 400);
    }

    const swept = sweepOrphans(merged as any) as typeof merged;
    const mcpTools = deps.hub.toolsForChat();
    const tools = assembleTools({ host: host as Host, mcpTools });

    const result = streamText({
      model,
      system: systemPromptForHost(host as Host),
      messages: await convertToModelMessages(swept as any),
      tools,
      stopWhen: stepCountIs(20),
    });

    result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: swept as any,
      generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
      onFinish: ({ messages: finalMessages }) => {
        deps.messages.replaceAll(
          id,
          (finalMessages as any).map((m: any) => ({
            id: m.id,
            conversationId: id,
            role: m.role,
            parts: m.parts ?? [],
            metadata: m.metadata ?? null,
          })),
        );
        deps.conversations.touch(id);
      },
    });
  });

  return r;
}
```

- [ ] **Step 2: Wire into `app.ts`**

Replace the body of `apps/server/src/app.ts`:
```ts
import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import type { LanguageModel } from 'ai';
import { healthRouter } from './routes/health';
import { bearerAuth } from './middleware/auth';
import { settingsRouter } from './routes/settings';
import { conversationsRouter } from './routes/conversations';
import { providersRouter } from './routes/providers';
import { mcpRouter } from './routes/mcp';
import { chatRouter } from './routes/chat';
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
  modelOverride?: (providerId: string, modelId: string) => LanguageModel;
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
  app.route('/api/chat', chatRouter({
    conversations,
    messages,
    registry,
    hub,
    modelOverride: config.modelOverride,
  }));

  hub.startAll().catch((err) => console.error('mcp startAll failed', err));

  return app;
}
```

- [ ] **Step 3: Run, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/chat.test.ts
```
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): /api/chat streams via streamText + persists via onFinish"
```

---

## Task 9: `/bootstrap` route

**Files:**
- Create: `apps/server/src/routes/bootstrap.test.ts`
- Create: `apps/server/src/routes/bootstrap.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/routes/bootstrap.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

describe('GET /bootstrap', () => {
  function mk(token: string) {
    const db = openDb({ url: ':memory:' });
    return createApp({ version: 't', db, authToken: token });
  }

  it('rejects requests with a bad Origin', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(r.status).toBe(403);
  });

  it('returns token + version when Origin is correct', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap', {
      headers: { Origin: 'https://localhost:47318' },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.token).toBe('tok');
    expect(typeof body.version).toBe('string');
  });

  it('also accepts http://localhost:<port> in dev', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap', {
      headers: { Origin: 'http://localhost:47318' },
    });
    expect(r.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/bootstrap.test.ts
```

- [ ] **Step 3: Implement**

`apps/server/src/routes/bootstrap.ts`:
```ts
import { Hono } from 'hono';

const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function bootstrapRouter(opts: { token: string; version: string }) {
  const r = new Hono();
  r.get('/', (c) => {
    const origin = c.req.header('Origin') ?? '';
    if (!ALLOWED_ORIGIN.test(origin)) return c.json({ error: 'forbidden' }, 403);
    return c.json({ token: opts.token, version: opts.version });
  });
  return r;
}
```

- [ ] **Step 4: Wire into `app.ts`** (insert before bearer middleware)

In `createApp`, after `app.route('/', healthRouter(...))` add:
```ts
app.route('/bootstrap', bootstrapRouter({ token: config.authToken, version: config.version }));
```
Add the import at the top:
```ts
import { bootstrapRouter } from './routes/bootstrap';
```

- [ ] **Step 5: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/bootstrap.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): GET /bootstrap returns token+version, origin-gated to localhost"
```

---

## Task 10: Frontend — install `@ai-sdk/react`, drop server-only deps

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Update web deps**

In `apps/web/package.json` `dependencies`, replace the AI SDK provider list with just the React UI hook (the providers now live server-side):
```json
{
  "@ai-sdk/react": "^3.0.0",
  "ai": "^6.0.168",
  "@fluentui/react-components": "^9.73.7",
  "@fluentui/react-icons": "^2.0.324",
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "shiki": "^4.0.2",
  "zod": "^4.3.6"
}
```

Remove the following entries (now server-only): `@ai-sdk/anthropic`, `@ai-sdk/deepseek`, `@ai-sdk/gateway`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/mcp`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`, `@ai-sdk/xai`, `@openrouter/ai-sdk-provider`, `ollama-ai-provider-v2`.

Run:
```bash
npm install
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(web): drop server-only AI SDK providers; add @ai-sdk/react"
```

---

## Task 11: Frontend — `api.ts` (bootstrap + small fetch helpers)

**Files:**
- Create: `apps/web/src/taskpane/api.ts`
- Create: `apps/web/src/taskpane/api.test.ts`

- [ ] **Step 1: Failing test**

`apps/web/src/taskpane/api.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrap, apiGet, apiSend, getTokenForTests } from './api';

describe('api', () => {
  beforeEach(() => {
    (globalThis as any).fetch = vi.fn();
  });

  it('bootstrap stores the token returned by /bootstrap', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ token: 't', version: 'v' }), { status: 200 }));
    await bootstrap();
    expect(getTokenForTests()).toBe('t');
  });

  it('apiGet attaches Authorization header', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await bootstrap();  // sets token from previous test? reset
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ token: 'tk', version: 'v' }), { status: 200 }));
    await bootstrap();
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await apiGet('/api/settings');
    const lastCall = (fetch as any).mock.calls.at(-1);
    expect(lastCall[1].headers.Authorization).toBe('Bearer tk');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/web run test
```

- [ ] **Step 3: Implement**

`apps/web/src/taskpane/api.ts`:
```ts
let token: string | null = null;
let version: string | null = null;

export async function bootstrap(): Promise<{ token: string; version: string }> {
  const res = await fetch('/bootstrap', { credentials: 'omit' });
  if (!res.ok) throw new Error(`bootstrap failed: ${res.status}`);
  const body = await res.json();
  token = body.token;
  version = body.version;
  return body;
}

export function getToken(): string {
  if (!token) throw new Error('Call bootstrap() first');
  return token;
}

export function getVersion(): string {
  return version ?? '';
}

// test-only
export function getTokenForTests(): string | null {
  return token;
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getToken()}` };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export async function apiSend<T = unknown>(
  path: string,
  body: unknown,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/web run test -- src/taskpane/api.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/taskpane/api.ts apps/web/src/taskpane/api.test.ts
git commit -m "feat(web/api): bootstrap + bearer-attaching fetch helpers"
```

---

## Task 12: Frontend — `transport.ts` (DefaultChatTransport factory)

**Files:**
- Create: `apps/web/src/taskpane/chat/transport.ts`

- [ ] **Step 1: Implement**

`apps/web/src/taskpane/chat/transport.ts`:
```ts
import { DefaultChatTransport } from 'ai';
import { getToken } from '../api';
import type { Host } from '@shared';

export function makeChatTransport(args: { host: Host; providerId: string; modelId: string }) {
  return new DefaultChatTransport({
    api: '/api/chat',
    headers: () => ({ Authorization: `Bearer ${getToken()}` }),
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
      if (trigger === 'submit-user-message') {
        return {
          body: {
            id,
            host: args.host,
            providerId: args.providerId,
            modelId: args.modelId,
            trigger,
            message: messages[messages.length - 1],
          },
        };
      }
      return {
        body: {
          id,
          host: args.host,
          providerId: args.providerId,
          modelId: args.modelId,
          trigger,
          messageId,
        },
      };
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/taskpane/chat/transport.ts
git commit -m "feat(web/chat): DefaultChatTransport factory (last-message-only body)"
```

---

## Task 13: Frontend — `on-tool-call.ts` for `execute_code`

**Files:**
- Create: `apps/web/src/taskpane/chat/on-tool-call.test.ts`
- Create: `apps/web/src/taskpane/chat/on-tool-call.ts`

- [ ] **Step 1: Failing test**

`apps/web/src/taskpane/chat/on-tool-call.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { makeOnToolCall } from './on-tool-call';

describe('makeOnToolCall', () => {
  it('runs execute_code immediately when autoApprove is true', async () => {
    const runInIframe = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => true,
    });
    await handler({ toolCall: { toolName: 'execute_code', toolCallId: 'tc1', input: { code: 'x' }, dynamic: false } } as any);
    expect(runInIframe).toHaveBeenCalledWith('x');
    expect(addToolOutput).toHaveBeenCalledWith({
      tool: 'execute_code',
      toolCallId: 'tc1',
      output: { ok: true, value: 42 },
    });
  });

  it('does NOT run execute_code when autoApprove is false', async () => {
    const runInIframe = vi.fn();
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => false,
    });
    await handler({ toolCall: { toolName: 'execute_code', toolCallId: 'tc1', input: { code: 'x' }, dynamic: false } } as any);
    expect(runInIframe).not.toHaveBeenCalled();
    expect(addToolOutput).not.toHaveBeenCalled();
  });

  it('skips dynamic tool calls (server-handled MCP)', async () => {
    const runInIframe = vi.fn();
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => true,
    });
    await handler({ toolCall: { toolName: 'mcp_x/list', toolCallId: 'tc1', input: {}, dynamic: true } } as any);
    expect(runInIframe).not.toHaveBeenCalled();
  });

  it('reports output-error on iframe throw', async () => {
    const runInIframe = vi.fn().mockRejectedValue(new Error('boom'));
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => true,
    });
    await handler({ toolCall: { toolName: 'execute_code', toolCallId: 'tc1', input: { code: 'x' }, dynamic: false } } as any);
    expect(addToolOutput).toHaveBeenCalledWith(expect.objectContaining({ state: 'output-error' }));
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/web run test -- src/taskpane/chat/on-tool-call.test.ts
```

- [ ] **Step 3: Implement**

`apps/web/src/taskpane/chat/on-tool-call.ts`:
```ts
type ToolCall = {
  toolCall: {
    toolName: string;
    toolCallId: string;
    input: unknown;
    dynamic: boolean;
  };
};

type AddToolOutput = (args: { tool: string; toolCallId: string; output?: unknown; state?: 'output-error'; errorText?: string }) => void;

export function makeOnToolCall(deps: {
  runInIframe: (code: string) => Promise<unknown>;
  addToolOutput: AddToolOutput;
  isAutoApprove: () => boolean;
}) {
  return async ({ toolCall }: ToolCall) => {
    if (toolCall.dynamic) return;
    if (toolCall.toolName !== 'execute_code') return;
    if (!deps.isAutoApprove()) return;
    try {
      const code = (toolCall.input as { code: string }).code;
      const output = await deps.runInIframe(code);
      deps.addToolOutput({ tool: 'execute_code', toolCallId: toolCall.toolCallId, output });
    } catch (err) {
      deps.addToolOutput({
        tool: 'execute_code',
        toolCallId: toolCall.toolCallId,
        state: 'output-error',
        errorText: (err as Error).message,
      });
    }
  };
}
```

- [ ] **Step 4: Run tests, confirm passing**

```bash
npm --workspace @autooffice/web run test -- src/taskpane/chat/on-tool-call.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/taskpane/chat
git commit -m "feat(web/chat): onToolCall handler dispatches execute_code via iframe"
```

---

## Task 14: Frontend — parts renderers

**Files:**
- Create: `apps/web/src/taskpane/components/parts/TextPart.tsx`
- Create: `apps/web/src/taskpane/components/parts/StepStartPart.tsx`
- Create: `apps/web/src/taskpane/components/parts/ExecuteCodePart.tsx`
- Create: `apps/web/src/taskpane/components/parts/LookupSkillPart.tsx`
- Create: `apps/web/src/taskpane/components/parts/DynamicToolPart.tsx`
- Create: `apps/web/src/taskpane/components/parts/ApprovalRequestedPart.tsx`

- [ ] **Step 1: TextPart**

```tsx
import React from 'react';

export function TextPart({ part }: { part: { text: string } }) {
  return <span>{part.text}</span>;
}
```

- [ ] **Step 2: StepStartPart**

```tsx
import React from 'react';

export function StepStartPart() {
  return <hr style={{ margin: '8px 0', opacity: 0.5 }} />;
}
```

- [ ] **Step 3: ExecuteCodePart**

```tsx
import React from 'react';

type Props = {
  part: { state: string; toolCallId: string; input?: { code?: string }; output?: unknown; errorText?: string };
  onApprove: (toolCallId: string, code: string) => void;
  onReject: (toolCallId: string) => void;
  highlight: (code: string) => React.ReactNode;
};

export function ExecuteCodePart({ part, onApprove, onReject, highlight }: Props) {
  const code = part.input?.code ?? '';
  return (
    <div style={{ border: '1px solid var(--colorNeutralStroke2)', borderRadius: 4, padding: 8 }}>
      <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{highlight(code)}</div>
      {part.state === 'input-available' && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => onApprove(part.toolCallId, code)}>Approve</button>
          <button onClick={() => onReject(part.toolCallId)} style={{ marginLeft: 8 }}>Reject</button>
        </div>
      )}
      {part.state === 'output-available' && (
        <pre style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>{JSON.stringify(part.output, null, 2)}</pre>
      )}
      {part.state === 'output-error' && (
        <pre style={{ marginTop: 8, color: 'var(--colorPaletteRedForeground1)' }}>{part.errorText}</pre>
      )}
    </div>
  );
}
```

- [ ] **Step 4: LookupSkillPart**

```tsx
import React from 'react';

export function LookupSkillPart({ part }: { part: { state: string; input?: { name?: string }; output?: { body?: string } } }) {
  const name = part.input?.name ?? '?';
  if (part.state !== 'output-available') {
    return <span style={{ opacity: 0.7, fontSize: 12 }}>Looking up: {name}</span>;
  }
  return <span style={{ opacity: 0.7, fontSize: 12 }}>📖 Looked up: {name}</span>;
}
```

- [ ] **Step 5: DynamicToolPart** (used for any unknown tool — including persisted MCP tools whose servers were removed)

```tsx
import React from 'react';

export function DynamicToolPart({ part }: { part: { toolName?: string; input?: unknown; output?: unknown; state?: string; errorText?: string } }) {
  return (
    <details style={{ border: '1px solid var(--colorNeutralStroke2)', borderRadius: 4, padding: 4 }}>
      <summary>{part.toolName ?? 'tool'} ({part.state ?? 'unknown'})</summary>
      <div style={{ fontSize: 12 }}>
        <div><b>Input:</b> <pre>{JSON.stringify(part.input, null, 2)}</pre></div>
        {part.output != null && <div><b>Output:</b> <pre>{JSON.stringify(part.output, null, 2)}</pre></div>}
        {part.errorText && <div style={{ color: 'var(--colorPaletteRedForeground1)' }}>{part.errorText}</div>}
      </div>
    </details>
  );
}
```

- [ ] **Step 6: ApprovalRequestedPart** (for server-side tools with `needsApproval: true` — i.e. MCP tools with `ask` policy)

```tsx
import React from 'react';

type Props = {
  part: { type: string; toolCallId?: string; input?: unknown; approval?: { id: string }; state?: string };
  onResponse: (id: string, approved: boolean) => void;
};

export function ApprovalRequestedPart({ part, onResponse }: Props) {
  if (part.state !== 'approval-requested' || !part.approval) return null;
  return (
    <div style={{ border: '1px solid var(--colorPaletteYellowBorder1)', padding: 8, borderRadius: 4 }}>
      <div>Tool <code>{part.type.replace(/^tool-/, '')}</code> requests approval to run with:</div>
      <pre style={{ fontSize: 12 }}>{JSON.stringify(part.input, null, 2)}</pre>
      <div style={{ marginTop: 8 }}>
        <button onClick={() => onResponse(part.approval!.id, true)}>Approve</button>
        <button onClick={() => onResponse(part.approval!.id, false)} style={{ marginLeft: 8 }}>Deny</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: One representative test for the parts**

`apps/web/src/taskpane/components/parts/parts.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextPart } from './TextPart';
import { ExecuteCodePart } from './ExecuteCodePart';

describe('TextPart', () => {
  it('renders text', () => {
    render(<TextPart part={{ text: 'hello' }} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

describe('ExecuteCodePart', () => {
  it('shows Approve when state is input-available', () => {
    const onApprove = vi.fn();
    render(
      <ExecuteCodePart
        part={{ state: 'input-available', toolCallId: 'tc', input: { code: 'await 1' } }}
        onApprove={onApprove}
        onReject={() => {}}
        highlight={(s) => s}
      />,
    );
    fireEvent.click(screen.getByText('Approve'));
    expect(onApprove).toHaveBeenCalledWith('tc', 'await 1');
  });
});
```

(Add `import { vi } from 'vitest'` at the top.)

- [ ] **Step 8: Run tests, confirm passing**

```bash
npm --workspace @autooffice/web run test -- src/taskpane/components/parts
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/taskpane/components/parts
git commit -m "feat(web): parts renderers for text/step-start/execute_code/lookup_skill/dynamic-tool/approval"
```

---

## Task 15: `MessageBubble.tsx` — switch on parts

**Files:**
- Modify: `apps/web/src/taskpane/components/MessageBubble.tsx`

- [ ] **Step 1: Replace the rendering body with a parts switch**

Open the file and replace the message body render with:
```tsx
{message.parts.map((part: any, idx: number) => {
  switch (part.type) {
    case 'text':
      return <TextPart key={idx} part={part} />;
    case 'step-start':
      return idx > 0 ? <StepStartPart key={idx} /> : null;
    case 'tool-execute_code':
      return <ExecuteCodePart key={idx} part={part} onApprove={onApproveCode} onReject={onRejectCode} highlight={highlightCode} />;
    case 'tool-lookup_skill':
      return <LookupSkillPart key={idx} part={part} />;
    case 'dynamic-tool':
      return <DynamicToolPart key={idx} part={part} />;
    default:
      // Server-side tools with needsApproval emit `tool-<name>` parts.
      // Render approval-requested via ApprovalRequestedPart; otherwise treat as DynamicTool.
      if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
        if (part.state === 'approval-requested') {
          return <ApprovalRequestedPart key={idx} part={part} onResponse={onApprovalResponse} />;
        }
        return <DynamicToolPart key={idx} part={{ ...part, toolName: part.type.slice(5) }} />;
      }
      return null;  // forward-compat: unknown future part types
  }
})}
```

Add the imports at the top of `MessageBubble.tsx`:
```tsx
import { TextPart } from './parts/TextPart';
import { StepStartPart } from './parts/StepStartPart';
import { ExecuteCodePart } from './parts/ExecuteCodePart';
import { LookupSkillPart } from './parts/LookupSkillPart';
import { DynamicToolPart } from './parts/DynamicToolPart';
import { ApprovalRequestedPart } from './parts/ApprovalRequestedPart';
```

Add the four callback props to the component's props type: `onApproveCode`, `onRejectCode`, `onApprovalResponse`, `highlightCode`.

- [ ] **Step 2: Adjust call sites in `ChatPanel.tsx`** to pass the new props (you'll define the handlers in `App.tsx` next).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/taskpane/components
git commit -m "refactor(web): MessageBubble switches on UI message part types"
```

---

## Task 16: `App.tsx` — `useChat` integration

**Files:**
- Modify: `apps/web/src/taskpane/App.tsx`
- Delete: `apps/web/src/taskpane/agent/orchestrator.ts`
- Delete: `apps/web/src/taskpane/agent/tools.ts`
- Delete: `apps/web/src/taskpane/agent/providers.ts`
- Delete: `apps/web/src/taskpane/store/settings.ts`

- [ ] **Step 1: Top of `App.tsx` — bootstrap on mount**

Replace the existing imports + initial-state setup with:
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai';
import { bootstrap, apiGet, apiSend } from './api';
import { makeChatTransport } from './chat/transport';
import { makeOnToolCall } from './chat/on-tool-call';
import { runInIframe } from './executor/sandbox';
import type { Settings, Conversation, Message, Host } from '@shared';

export default function App({ host }: { host: Host }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);

  useEffect(() => {
    (async () => {
      await bootstrap();
      const s = (await apiGet<Settings>('/api/settings'));
      setSettings(s);
      const list = await apiGet<Conversation[]>('/api/conversations');
      let id: string;
      if (list.length === 0) {
        id = (await apiSend<{ id: string }>('/api/conversations', { host })).id;
      } else {
        id = list[0]!.id;
      }
      const conv = await apiGet<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}`);
      setConversationId(id);
      setInitialMessages(conv.messages);
      setReady(true);
    })().catch((err) => console.error(err));
  }, [host]);

  if (!ready || !settings || !conversationId) return <div>Loading…</div>;

  return (
    <ChatScreen
      host={host}
      conversationId={conversationId}
      initialMessages={initialMessages}
      settings={settings}
    />
  );
}
```

- [ ] **Step 2: Add `ChatScreen` (keep in same file for now)**

```tsx
function ChatScreen({
  host,
  conversationId,
  initialMessages,
  settings,
}: {
  host: Host;
  conversationId: string;
  initialMessages: Message[];
  settings: Settings;
}) {
  const transport = useMemo(
    () => makeChatTransport({
      host,
      providerId: settings.selectedProviderId ?? '',
      modelId: settings.selectedModelId ?? '',
    }),
    [host, settings.selectedProviderId, settings.selectedModelId],
  );

  const { messages, sendMessage, status, addToolOutput, addToolApprovalResponse } = useChat({
    id: conversationId,
    messages: initialMessages as any,
    transport,
    sendAutomaticallyWhen: (msgs: any) =>
      lastAssistantMessageIsCompleteWithToolCalls(msgs) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(msgs),
    onToolCall: makeOnToolCall({
      runInIframe,
      addToolOutput: (a) => addToolOutput(a as any),
      isAutoApprove: () => settings.autoApprove,
    }),
  });

  // …existing ChatPanel JSX, passing messages + sendMessage + the four handlers…
  return (
    <ChatPanel
      messages={messages}
      status={status}
      onSubmit={(text) => sendMessage({ text })}
      onApproveCode={async (toolCallId, code) => {
        try {
          const output = await runInIframe(code);
          addToolOutput({ tool: 'execute_code', toolCallId, output } as any);
        } catch (err) {
          addToolOutput({ tool: 'execute_code', toolCallId, state: 'output-error', errorText: (err as Error).message } as any);
        }
      }}
      onRejectCode={(toolCallId) =>
        addToolOutput({ tool: 'execute_code', toolCallId, state: 'output-error', errorText: 'User rejected' } as any)
      }
      onApprovalResponse={(id, approved) => addToolApprovalResponse({ id, approved })}
      highlightCode={(code) => code /* existing Shiki integration here */}
    />
  );
}
```

- [ ] **Step 3: Delete the old orchestrator and friends**

```bash
rm apps/web/src/taskpane/agent/orchestrator.ts
rm apps/web/src/taskpane/agent/tools.ts
rm apps/web/src/taskpane/agent/providers.ts
rm apps/web/src/taskpane/store/settings.ts
```

If the `agent/` directory is now empty, remove it: `rmdir apps/web/src/taskpane/agent`.

- [ ] **Step 4: Adjust `ChatPanel.tsx` props**

Update `ChatPanel`'s prop type to receive the four handlers and pass them to `MessageBubble`. Replace any code path that imports the removed files.

- [ ] **Step 5: Build and confirm web compiles**

```bash
npm --workspace @autooffice/web run build
```
Expected: a `dist/` is produced. Fix any remaining import errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/taskpane
git commit -m "refactor(web): replace in-browser orchestrator with useChat + DefaultChatTransport"
```

---

## Task 17: Manual smoke test on the dev server

**Files:** None.

- [ ] **Step 1: Start dev**

```bash
AUTOOFFICE_TOKEN=devtoken npm run dev
```

- [ ] **Step 2: From a Windows machine, sideload Word**

```powershell
npm run sideload
```

- [ ] **Step 3: Add a CLI-bridge provider via Settings UI** (Claude Code)

Verify `claude --version` works in the same shell. Expected: status badge shows `ready`. Open chat and type "make all paragraphs bold." The agent should call `lookup_skill` then `execute_code` then succeed.

- [ ] **Step 4: Add a stdio MCP server via Settings UI** (e.g. `@modelcontextprotocol/server-filesystem`)

Expected: status `connected`, two tools listed. Toggle one to `deny`, verify the model can't see it. Toggle one to `ask` and trigger it — approve UI shows.

- [ ] **Step 5: Push branch**

```bash
git push
```

CI must remain green.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: `/api/chat` with streamText, consumeStream, originalMessages, generateMessageId, onFinish; tool registry assembly with tri-state policy → needsApproval; orphan sweep; `/bootstrap`; client-side `execute_code`; useChat wiring with prepareSendMessagesRequest; parts renderers including dynamic-tool fallback for missing tools — all present.
- [x] No TODO/TBD placeholders.
- [x] Type names consistent: `Settings`, `Conversation`, `Message`, `Host`, `ChatToolWrapper`.
- [x] Built-in tools: `lookup_skill` server-side (with execute), `execute_code` client-side (no execute) — both correctly wired.
- [x] Orphan sweep covers tool-call parts AND dynamic-tool parts.
- [x] Old orchestrator + provider files actually deleted, not just abandoned.
- [x] No references to identifiers from later plans.
