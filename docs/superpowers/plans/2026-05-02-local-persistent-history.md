# Local Persistent Chat History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist AutoOffice chat conversations in `localStorage` so they survive task pane reloads, support multiple named conversations switchable from a history panel, and auto-title each conversation via the configured LLM after the first turn.

**Architecture:** Pure storage layer in `store/history.ts` (one index entry + one blob per conversation). New `HistoryPanel` modal mirrors the existing `SettingsPanel` shell. `App.tsx` owns the active-conversation id, hydrates from `localStorage` on mount, debounces a write after every turn, and fires a fire-and-forget LLM title call after the first turn. Cross-host scenarios (e.g. opening a Word conversation while the pane is in Excel) surface as a non-blocking banner — the orchestrator continues to use the current host's tools.

**Tech Stack:** TypeScript, React 19, Fluent UI, Vercel AI SDK (`generateText`), Vitest + React Testing Library + jsdom. Specification: `docs/superpowers/specs/2026-05-02-local-persistent-history-design.md`.

**Branch / worktree:** `feat/local-history`, working tree at `.worktrees/local-history` (already provisioned).

---

## File Map

**New files**

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest configuration (jsdom env). |
| `src/taskpane/store/history.ts` | Pure storage layer: index, blobs, eviction, truncation, schema versioning. No React. |
| `src/taskpane/store/history.test.ts` | Unit tests for the storage layer. |
| `src/taskpane/agent/title.ts` | `generateTitle()` — async LLM-backed title with silent fallback. |
| `src/taskpane/agent/title.test.ts` | Unit tests for title generation, mocking `createModel` + `generateText`. |
| `src/taskpane/components/HistoryPanel.tsx` | Modal shell mirroring `SettingsPanel`: filter chips, conversation list, rename inline, delete with confirm. |
| `src/taskpane/components/HistoryPanel.test.tsx` | RTL tests for filter behavior and row callbacks. |
| `src/taskpane/components/CrossHostBanner.tsx` | Tiny banner shown when active conversation's host differs from current. Owned by `ChatPanel`. |

**Modified files**

| Path | Changes |
|---|---|
| `package.json` | Add `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` devDeps. Add `test` script. |
| `src/taskpane/App.tsx` | State for `activeConversationId` + `showHistory`; hydrate on mount; debounce-save after `runAgent`; fire `generateTitle` after first turn with race-safe rename guard; pass banner state to `ChatPanel`. |
| `src/taskpane/components/ChatPanel.tsx` | Add `History` and `New chat` header buttons; render `CrossHostBanner` when prop set. |

**Untouched**

`src/taskpane/store/settings.ts`, `agent/orchestrator.ts`, `agent/providers.ts`, `agent/tools.ts`, `executor/*`, `mcp/*`, `skills/*`.

---

## Conventions used in this plan

- Each storage-layer function and the title generator follow strict TDD: write a failing test, run it red, implement, run it green, commit.
- React component tests cover **logic** (which callback fires when, which rows are visible under a given filter), not visual rendering.
- After every task, verify with `npm test` and `npx tsc --noEmit`. Commit only when both pass.
- Commits use Conventional-style prefix (`feat:`, `test:`, `chore:`). Mirror existing repo style which is sentence-case but the prefix helps the reviewer scan.
- Bytes throughout use `new Blob([str]).size` for accuracy with multi-byte chars.

---

## Task 1: Vitest infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `src/taskpane/store/__smoke.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
npm install --save-dev vitest@^3.0.0 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` updated, `node_modules/.bin/vitest` exists.

- [ ] **Step 2: Add `test` script to `package.json`**

In the `"scripts"` object, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/taskpane/test-setup.ts'],
  },
});
```

- [ ] **Step 4: Create `src/taskpane/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';

// jsdom does not implement crypto.randomUUID by default in some setups.
// Provide a deterministic-ish polyfill so tests don't need to stub it.
if (!globalThis.crypto || !globalThis.crypto.randomUUID) {
  let counter = 0;
  globalThis.crypto = {
    ...(globalThis.crypto ?? {}),
    randomUUID: () => `test-uuid-${++counter}-${Date.now()}` as `${string}-${string}-${string}-${string}-${string}`,
  } as Crypto;
}
```

- [ ] **Step 5: Write a smoke test**

Create `src/taskpane/store/__smoke.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('vitest infrastructure', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('runs in jsdom and has localStorage', () => {
    localStorage.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });

  it('has crypto.randomUUID', () => {
    const id = crypto.randomUUID();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run the smoke test**

```bash
npm test
```

Expected: `2 passed`. If it fails, fix the config before moving on.

- [ ] **Step 7: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/taskpane/test-setup.ts src/taskpane/store/__smoke.test.ts
git commit -m "chore: add vitest + jsdom test infrastructure"
```

---

## Task 2: history.ts — types and constants

**Files:**
- Create: `src/taskpane/store/history.ts`
- Create: `src/taskpane/store/history.test.ts`

- [ ] **Step 1: Write the failing test for type re-exports and constants**

Create `src/taskpane/store/history.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HISTORY_LIMITS,
  INDEX_KEY,
  blobKeyFor,
  type ConversationSummary,
  type Conversation,
} from './history.ts';

describe('history.ts — constants and key helpers', () => {
  beforeEach(() => localStorage.clear());

  it('exposes tunable byte limits with sane defaults', () => {
    expect(HISTORY_LIMITS.TOTAL_BYTES).toBe(4 * 1024 * 1024);
    expect(HISTORY_LIMITS.PER_CONVERSATION_BYTES).toBe(1 * 1024 * 1024);
  });

  it('uses the documented index key', () => {
    expect(INDEX_KEY).toBe('autooffice_history_index');
  });

  it('builds blob keys with the conv prefix', () => {
    expect(blobKeyFor('abc')).toBe('autooffice_history_conv_abc');
  });

  it('Conversation extends ConversationSummary structurally', () => {
    const summary: ConversationSummary = {
      id: 'a', title: 't', host: 'word', createdAt: 1, updatedAt: 1, messageCount: 0,
    };
    const conv: Conversation = {
      ...summary, v: 1, uiMessages: [], modelMessages: [],
    };
    expect(conv.v).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test (expect failure: module not found)**

```bash
npm test -- history.test
```

Expected: failure — `Cannot find module './history.ts'`.

- [ ] **Step 3: Create `src/taskpane/store/history.ts` with types + constants**

```ts
import type { ModelMessage } from 'ai';
import type { ChatMessage } from '../agent/orchestrator.ts';
import type { HostKind } from '../host/context.ts';

export const INDEX_KEY = 'autooffice_history_index';
const BLOB_KEY_PREFIX = 'autooffice_history_conv_';

export function blobKeyFor(id: string): string {
  return `${BLOB_KEY_PREFIX}${id}`;
}

export const HISTORY_LIMITS = {
  TOTAL_BYTES: 4 * 1024 * 1024,
  PER_CONVERSATION_BYTES: 1 * 1024 * 1024,
};

export type ConversationVersion = 1;
export const CURRENT_VERSION: ConversationVersion = 1;

export interface ConversationSummary {
  id: string;
  title: string;
  host: HostKind;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Conversation extends ConversationSummary {
  v: ConversationVersion;
  uiMessages: ChatMessage[];
  modelMessages: ModelMessage[];
}
```

- [ ] **Step 4: Run the test (expect pass)**

```bash
npm test -- history.test
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "feat: add history.ts types and storage key helpers"
```

---

## Task 3: history.ts — saveConversation + getConversation + listConversations

**Files:**
- Modify: `src/taskpane/store/history.ts`
- Modify: `src/taskpane/store/history.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `history.test.ts`:

```ts
import { saveConversation, getConversation, listConversations } from './history.ts';

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    v: 1,
    title: overrides.title ?? 'Hello',
    host: overrides.host ?? 'word',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    messageCount: overrides.messageCount ?? 1,
    uiMessages: overrides.uiMessages ?? [{ role: 'user', content: 'hi' }],
    modelMessages: overrides.modelMessages ?? [{ role: 'user', content: 'hi' }],
  };
}

describe('history.ts — save / get / list', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a conversation through save and get', () => {
    const c = makeConv({ id: 'x1', title: 'first' });
    saveConversation(c);
    const read = getConversation('x1');
    expect(read).toEqual(c);
  });

  it('returns null for an unknown id', () => {
    expect(getConversation('nope')).toBeNull();
  });

  it('upserts: saving with the same id replaces and updates the index', () => {
    const id = 'x2';
    saveConversation(makeConv({ id, title: 'old', updatedAt: 1000, messageCount: 1 }));
    saveConversation(makeConv({ id, title: 'new', updatedAt: 2000, messageCount: 5 }));
    expect(getConversation(id)?.title).toBe('new');
    expect(listConversations()).toHaveLength(1);
    expect(listConversations()[0].messageCount).toBe(5);
  });

  it('lists conversations sorted by updatedAt descending', () => {
    saveConversation(makeConv({ id: 'a', updatedAt: 1000 }));
    saveConversation(makeConv({ id: 'b', updatedAt: 3000 }));
    saveConversation(makeConv({ id: 'c', updatedAt: 2000 }));
    expect(listConversations().map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('list summary excludes the heavy message arrays', () => {
    saveConversation(makeConv({ id: 'a' }));
    const [summary] = listConversations();
    expect(summary).not.toHaveProperty('uiMessages');
    expect(summary).not.toHaveProperty('modelMessages');
    expect(summary).not.toHaveProperty('v');
  });

  it('survives a corrupted blob without clobbering the index', () => {
    saveConversation(makeConv({ id: 'good' }));
    localStorage.setItem(blobKeyFor('bad'), '{not valid json');
    // The index entry for "bad" does not exist (we never saved it), so this is
    // really verifying that getConversation handles a stray corrupted key
    // without throwing.
    expect(getConversation('bad')).toBeNull();
    expect(listConversations().map(s => s.id)).toEqual(['good']);
  });
});
```

- [ ] **Step 2: Run the tests (expect failure: imports not exported)**

```bash
npm test -- history.test
```

Expected: import errors.

- [ ] **Step 3: Implement save / get / list**

Append to `src/taskpane/store/history.ts`:

```ts
function readIndex(): ConversationSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConversationSummary[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: ConversationSummary[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function summarize(c: Conversation): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    host: c.host,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount,
  };
}

export function listConversations(): ConversationSummary[] {
  return [...readIndex()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  try {
    const raw = localStorage.getItem(blobKeyFor(id));
    if (!raw) return null;
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

export function saveConversation(c: Conversation): void {
  localStorage.setItem(blobKeyFor(c.id), JSON.stringify(c));
  const index = readIndex().filter(s => s.id !== c.id);
  index.push(summarize(c));
  writeIndex(index);
}
```

- [ ] **Step 4: Run the tests (expect pass)**

```bash
npm test -- history.test
```

Expected: all passing.

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "feat: implement save / get / list for conversation history"
```

---

## Task 4: history.ts — renameConversation + deleteConversation

**Files:**
- Modify: `src/taskpane/store/history.ts`
- Modify: `src/taskpane/store/history.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `history.test.ts`:

```ts
import { renameConversation, deleteConversation } from './history.ts';

describe('history.ts — rename and delete', () => {
  beforeEach(() => localStorage.clear());

  it('renames the title in both blob and index', () => {
    saveConversation(makeConv({ id: 'r1', title: 'before' }));
    renameConversation('r1', 'after');
    expect(getConversation('r1')?.title).toBe('after');
    expect(listConversations()[0].title).toBe('after');
  });

  it('renaming an unknown id is a no-op (no throw)', () => {
    expect(() => renameConversation('nope', 'x')).not.toThrow();
    expect(listConversations()).toEqual([]);
  });

  it('deletes both blob and index entry', () => {
    saveConversation(makeConv({ id: 'd1' }));
    saveConversation(makeConv({ id: 'd2' }));
    deleteConversation('d1');
    expect(getConversation('d1')).toBeNull();
    expect(localStorage.getItem(blobKeyFor('d1'))).toBeNull();
    expect(listConversations().map(s => s.id)).toEqual(['d2']);
  });

  it('deleting an unknown id is a no-op', () => {
    saveConversation(makeConv({ id: 'd1' }));
    expect(() => deleteConversation('nope')).not.toThrow();
    expect(listConversations()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests (expect failure)**

```bash
npm test -- history.test
```

Expected: import errors for `renameConversation` / `deleteConversation`.

- [ ] **Step 3: Implement rename and delete**

Append to `src/taskpane/store/history.ts`:

```ts
export function renameConversation(id: string, title: string): void {
  const conv = getConversation(id);
  if (!conv) return;
  const next: Conversation = { ...conv, title };
  // Direct write — no updatedAt bump, since rename is metadata only.
  localStorage.setItem(blobKeyFor(id), JSON.stringify(next));
  const index = readIndex().map(s => s.id === id ? { ...s, title } : s);
  writeIndex(index);
}

export function deleteConversation(id: string): void {
  localStorage.removeItem(blobKeyFor(id));
  const index = readIndex().filter(s => s.id !== id);
  writeIndex(index);
}
```

- [ ] **Step 4: Run the tests (expect pass)**

```bash
npm test -- history.test
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "feat: implement rename and delete for conversation history"
```

---

## Task 5: history.ts — mostRecentForHost

**Files:**
- Modify: `src/taskpane/store/history.ts`
- Modify: `src/taskpane/store/history.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `history.test.ts`:

```ts
import { mostRecentForHost } from './history.ts';

describe('history.ts — mostRecentForHost', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing exists', () => {
    expect(mostRecentForHost('word')).toBeNull();
  });

  it('returns the newest conversation for the requested host', () => {
    saveConversation(makeConv({ id: 'w-old', host: 'word', updatedAt: 1000 }));
    saveConversation(makeConv({ id: 'w-new', host: 'word', updatedAt: 3000 }));
    saveConversation(makeConv({ id: 'e-newest', host: 'excel', updatedAt: 4000 }));
    expect(mostRecentForHost('word')?.id).toBe('w-new');
    expect(mostRecentForHost('excel')?.id).toBe('e-newest');
  });

  it('returns null when host has no conversations', () => {
    saveConversation(makeConv({ id: 'w', host: 'word' }));
    expect(mostRecentForHost('excel')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests (expect failure)**

```bash
npm test -- history.test
```

- [ ] **Step 3: Implement `mostRecentForHost`**

Append to `src/taskpane/store/history.ts`:

```ts
export function mostRecentForHost(host: HostKind): ConversationSummary | null {
  const matches = listConversations().filter(s => s.host === host);
  return matches[0] ?? null;
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- history.test
```

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "feat: implement mostRecentForHost lookup"
```

---

## Task 6: history.ts — eviction + per-conversation truncation + quota retry

**Files:**
- Modify: `src/taskpane/store/history.ts`
- Modify: `src/taskpane/store/history.test.ts`

This task introduces three behaviors that must work together. They share a single `saveConversation` code path, so we test them together but introduce them in stages.

- [ ] **Step 1: Add a `__resetForTests` test helper to the module**

In `src/taskpane/store/history.ts`, add:

```ts
// Test-only mutation hook. Production code never calls this. Exposed so
// unit tests can shrink the byte caps without overwriting them globally.
export const __testing = {
  setLimits(total: number, perConv: number) {
    HISTORY_LIMITS.TOTAL_BYTES = total;
    HISTORY_LIMITS.PER_CONVERSATION_BYTES = perConv;
  },
  resetLimits() {
    HISTORY_LIMITS.TOTAL_BYTES = 4 * 1024 * 1024;
    HISTORY_LIMITS.PER_CONVERSATION_BYTES = 1 * 1024 * 1024;
  },
};
```

- [ ] **Step 2: Write failing tests for eviction**

Append to `history.test.ts`:

```ts
import { __testing } from './history.ts';

function bigString(n: number): string {
  return 'x'.repeat(n);
}

describe('history.ts — eviction (soft total cap)', () => {
  beforeEach(() => {
    localStorage.clear();
    __testing.resetLimits();
  });

  afterAll(() => __testing.resetLimits());

  it('evicts oldest non-active conversations until under the total cap', () => {
    __testing.setLimits(/* total */ 5_000, /* perConv */ 100_000);

    // Each conversation is ~1.5 KB after JSON serialization
    saveConversation(makeConv({
      id: 'old', updatedAt: 1000,
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    saveConversation(makeConv({
      id: 'mid', updatedAt: 2000,
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    saveConversation(makeConv({
      id: 'new', updatedAt: 3000,
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));

    const ids = listConversations().map(s => s.id);
    // 'old' should have been evicted.
    expect(ids).not.toContain('old');
    expect(ids).toContain('new');
  });

  it('never evicts the just-saved (active) conversation, even if it is the oldest', () => {
    __testing.setLimits(2_000, 100_000);
    // Save two large conversations; the second save pushes us over the cap.
    saveConversation(makeConv({
      id: 'first', updatedAt: 5000, // newer
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    saveConversation(makeConv({
      id: 'second', updatedAt: 1000, // older — but this is the one being saved
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    const ids = listConversations().map(s => s.id);
    expect(ids).toContain('second'); // active save preserved
    expect(ids).not.toContain('first'); // older non-active evicted
  });
});
```

- [ ] **Step 3: Run tests (expect failure)**

```bash
npm test -- history.test
```

- [ ] **Step 4: Implement eviction inside `saveConversation`**

Replace the existing `saveConversation` body in `src/taskpane/store/history.ts`:

```ts
function totalBlobBytes(): number {
  let sum = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(BLOB_KEY_PREFIX)) {
      const v = localStorage.getItem(k);
      if (v) sum += new Blob([v]).size;
    }
  }
  return sum;
}

function evictOldestUntilUnder(activeId: string, cap: number): void {
  while (totalBlobBytes() > cap) {
    const candidates = readIndex()
      .filter(s => s.id !== activeId)
      .sort((a, b) => a.updatedAt - b.updatedAt); // oldest first
    const oldest = candidates[0];
    if (!oldest) return; // nothing else to evict
    deleteConversation(oldest.id);
  }
}

export function saveConversation(c: Conversation): void {
  // Persist first so the active conversation is the freshest blob on disk.
  localStorage.setItem(blobKeyFor(c.id), JSON.stringify(c));
  const index = readIndex().filter(s => s.id !== c.id);
  index.push(summarize(c));
  writeIndex(index);

  evictOldestUntilUnder(c.id, HISTORY_LIMITS.TOTAL_BYTES);
}
```

- [ ] **Step 5: Run eviction tests (expect pass)**

```bash
npm test -- history.test
```

- [ ] **Step 6: Write failing tests for per-conversation truncation**

Append to `history.test.ts`:

```ts
describe('history.ts — per-conversation truncation', () => {
  beforeEach(() => {
    localStorage.clear();
    __testing.resetLimits();
  });

  afterAll(() => __testing.resetLimits());

  it('truncates the oldest large codeBlock.result strings until under cap', () => {
    __testing.setLimits(/* total */ 100_000_000, /* perConv */ 1_500);

    const huge = bigString(2_000);
    const conv = makeConv({
      id: 't1',
      uiMessages: [
        { role: 'assistant', content: '', codeBlock: { code: 'a', status: 'success', result: huge } },
        { role: 'assistant', content: '', codeBlock: { code: 'b', status: 'success', result: huge } },
        { role: 'assistant', content: '', codeBlock: { code: 'c', status: 'success', result: 'small' } },
      ],
    });

    saveConversation(conv);

    const stored = getConversation('t1')!;
    // Oldest large result was replaced first
    expect(stored.uiMessages[0].codeBlock!.result).toBe('[truncated]');
    // Smallest / latest should be preserved
    expect(stored.uiMessages[2].codeBlock!.result).toBe('small');
    // Conversation is now under the cap
    const size = new Blob([JSON.stringify(stored)]).size;
    expect(size).toBeLessThanOrEqual(1_500);
  });

  it('preserves message structure even when truncating', () => {
    __testing.setLimits(100_000_000, 800);
    const huge = bigString(3_000);
    saveConversation(makeConv({
      id: 't2',
      uiMessages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: '', codeBlock: { code: 'x', status: 'success', result: huge } },
      ],
    }));
    const stored = getConversation('t2')!;
    expect(stored.uiMessages).toHaveLength(2);
    expect(stored.uiMessages[0].content).toBe('hello');
    expect(stored.uiMessages[1].codeBlock!.result).toBe('[truncated]');
  });
});
```

- [ ] **Step 7: Run truncation tests (expect failure)**

```bash
npm test -- history.test
```

- [ ] **Step 8: Implement per-conversation truncation**

In `src/taskpane/store/history.ts`, add the helper and call it from `saveConversation` **before** writing the blob:

```ts
function conversationBytes(c: Conversation): number {
  return new Blob([JSON.stringify(c)]).size;
}

function truncateInPlace(c: Conversation, cap: number): void {
  if (conversationBytes(c) <= cap) return;
  // Walk uiMessages oldest-first, replacing codeBlock.result strings until under cap.
  for (const msg of c.uiMessages) {
    if (conversationBytes(c) <= cap) return;
    const cb = msg.codeBlock;
    if (cb && typeof cb.result === 'string' && cb.result !== '[truncated]') {
      cb.result = '[truncated]';
    }
  }
  // If still over cap (e.g. very long user messages), best-effort: leave as-is.
  // The total-cap eviction will continue to keep the global store bounded.
}
```

Update `saveConversation`'s first line to call truncation on a defensive copy first, then persist that copy:

```ts
export function saveConversation(c: Conversation): void {
  // Defensive copy so callers don't see their objects mutated.
  const toStore: Conversation = JSON.parse(JSON.stringify(c));
  truncateInPlace(toStore, HISTORY_LIMITS.PER_CONVERSATION_BYTES);

  localStorage.setItem(blobKeyFor(toStore.id), JSON.stringify(toStore));
  const index = readIndex().filter(s => s.id !== toStore.id);
  index.push(summarize(toStore));
  writeIndex(index);

  evictOldestUntilUnder(toStore.id, HISTORY_LIMITS.TOTAL_BYTES);
}
```

- [ ] **Step 9: Run all storage tests (expect pass)**

```bash
npm test -- history.test
```

- [ ] **Step 10: Write failing test for QuotaExceededError retry**

Append to `history.test.ts`:

```ts
describe('history.ts — quota-exceeded retry', () => {
  beforeEach(() => {
    localStorage.clear();
    __testing.resetLimits();
  });
  afterAll(() => __testing.resetLimits());

  it('evicts and retries when setItem throws QuotaExceededError once', () => {
    saveConversation(makeConv({ id: 'old', updatedAt: 100 }));
    saveConversation(makeConv({ id: 'new', updatedAt: 999 }));

    // Make the *next* setItem call throw a single QuotaExceededError.
    const real = Storage.prototype.setItem;
    let throws = 1;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (throws > 0 && k.startsWith('autooffice_history_conv_')) {
        throws--;
        const err = new DOMException('quota', 'QuotaExceededError');
        throw err;
      }
      return real.call(this, k, v);
    });

    try {
      saveConversation(makeConv({ id: 'incoming', updatedAt: 2000 }));
    } finally {
      spy.mockRestore();
    }

    const ids = listConversations().map(s => s.id);
    expect(ids).toContain('incoming');
  });
});
```

Add `vi` to the imports at the top of the file:

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
```

- [ ] **Step 11: Run quota test (expect failure)**

```bash
npm test -- history.test
```

- [ ] **Step 12: Implement quota retry in `saveConversation`**

Wrap the blob `setItem` call with retry-on-quota-exceeded:

```ts
function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.code === 22;
  }
  return false;
}

function setItemWithQuotaRetry(key: string, value: string, activeId: string): void {
  try {
    localStorage.setItem(key, value);
    return;
  } catch (err) {
    if (!isQuotaExceeded(err)) throw err;
    // Aggressive eviction: shrink to half the cap to make room.
    evictOldestUntilUnder(activeId, Math.floor(HISTORY_LIMITS.TOTAL_BYTES / 2));
    try {
      localStorage.setItem(key, value);
    } catch (err2) {
      if (isQuotaExceeded(err2)) {
        console.warn('[history] localStorage full; chat history not persisted this turn');
        return;
      }
      throw err2;
    }
  }
}
```

Replace the blob-write line in `saveConversation`:

```ts
setItemWithQuotaRetry(blobKeyFor(toStore.id), JSON.stringify(toStore), toStore.id);
```

- [ ] **Step 13: Run all tests (expect pass)**

```bash
npm test -- history.test
```

- [ ] **Step 14: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 15: Commit**

```bash
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "feat: add history eviction, per-conversation truncation, quota retry"
```

---

## Task 7: history.ts — schema versioning

**Files:**
- Modify: `src/taskpane/store/history.ts`
- Modify: `src/taskpane/store/history.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `history.test.ts`:

```ts
describe('history.ts — schema versioning', () => {
  beforeEach(() => localStorage.clear());

  it('readable: getConversation still returns blobs with unknown v', () => {
    const future = { ...makeConv({ id: 'fut' }), v: 99 };
    localStorage.setItem(blobKeyFor('fut'), JSON.stringify(future));
    const read = getConversation('fut');
    expect(read?.v).toBe(99);
  });

  it('writable: saveConversation refuses to overwrite a future-version blob', () => {
    const future = { ...makeConv({ id: 'fut', title: 'future' }), v: 99 };
    localStorage.setItem(blobKeyFor('fut'), JSON.stringify(future));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveConversation(makeConv({ id: 'fut', title: 'overwritten' }));
    warn.mockRestore();

    // The blob on disk still has v: 99 and the original title.
    expect(getConversation('fut')?.title).toBe('future');
  });
});
```

- [ ] **Step 2: Run tests (expect failure)**

The future-blob test will fail because `saveConversation` blindly overwrites.

- [ ] **Step 3: Implement schema-version guard**

At the top of `saveConversation` (after the defensive copy), add:

```ts
  // Refuse to overwrite a blob written by a newer schema version.
  const existingRaw = localStorage.getItem(blobKeyFor(toStore.id));
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as Partial<Conversation>;
      if (typeof existing.v === 'number' && existing.v > CURRENT_VERSION) {
        console.warn(`[history] refusing to overwrite v${existing.v} blob with v${CURRENT_VERSION}; conversation ${toStore.id} not persisted`);
        return;
      }
    } catch {
      // Corrupt JSON — let normal save path proceed (we'll overwrite garbage).
    }
  }
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- history.test
```

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "feat: refuse to overwrite future-schema-version conversation blobs"
```

---

## Task 8: title.ts — async LLM-backed title generator

**Files:**
- Create: `src/taskpane/agent/title.ts`
- Create: `src/taskpane/agent/title.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  createModel: vi.fn(),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: mocks.generateText };
});
vi.mock('./providers.ts', () => ({ createModel: mocks.createModel }));

import { generateTitle } from './title.ts';
import type { AppSettings } from '../store/settings.ts';
import type { ModelMessage } from 'ai';

const settings: AppSettings = {
  selectedProviderId: 'anthropic',
  selectedModel: 'claude-opus-4-7',
  providers: [{ id: 'anthropic', name: 'Anthropic', apiKey: 'k' }],
  autoApprove: false,
  mcpServers: [],
  maxRetries: 3,
  executionTimeout: 30000,
};

const messages: ModelMessage[] = [
  { role: 'user', content: 'help me build a chart' },
  { role: 'assistant', content: 'Sure, what data?' },
];

describe('generateTitle', () => {
  beforeEach(() => {
    mocks.generateText.mockReset();
    mocks.createModel.mockReset();
    mocks.createModel.mockReturnValue('FAKE_MODEL');
  });

  it('returns a trimmed, capped title from the model', async () => {
    mocks.generateText.mockResolvedValue({ text: '  Build A Sales Chart  ' });
    const out = await generateTitle(messages, settings);
    expect(out).toBe('Build A Sales Chart');
    expect(mocks.createModel).toHaveBeenCalledWith(settings);
  });

  it('caps the title at 50 chars', async () => {
    mocks.generateText.mockResolvedValue({ text: 'A'.repeat(120) });
    const out = await generateTitle(messages, settings);
    expect(out!.length).toBe(50);
  });

  it('returns null on model error', async () => {
    mocks.generateText.mockRejectedValue(new Error('rate limit'));
    const out = await generateTitle(messages, settings);
    expect(out).toBeNull();
  });

  it('returns null on empty/whitespace response', async () => {
    mocks.generateText.mockResolvedValue({ text: '   ' });
    const out = await generateTitle(messages, settings);
    expect(out).toBeNull();
  });

  it('returns null when createModel throws (no API key etc.)', async () => {
    mocks.createModel.mockImplementation(() => { throw new Error('no key'); });
    const out = await generateTitle(messages, settings);
    expect(out).toBeNull();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('strips wrapping quotes from the model response', async () => {
    mocks.generateText.mockResolvedValue({ text: '"Quarterly Plan"' });
    const out = await generateTitle(messages, settings);
    expect(out).toBe('Quarterly Plan');
  });
});
```

- [ ] **Step 2: Run tests (expect failure: module not found)**

```bash
npm test -- title.test
```

- [ ] **Step 3: Implement `title.ts`**

```ts
import { generateText, type ModelMessage } from 'ai';
import { createModel } from './providers.ts';
import type { AppSettings } from '../store/settings.ts';

const TITLE_PROMPT =
  'Generate a 3-6 word title for the following chat. ' +
  'Reply with only the title, no quotes, no punctuation, no surrounding text.';

const MAX_TITLE_LEN = 50;

function transcriptOf(messages: ModelMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role.toUpperCase();
      const content = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(p => 'text' in p && typeof p.text === 'string' ? p.text : '').join(' ').trim()
          : '';
      return `${role}: ${content}`;
    })
    .join('\n');
}

function clean(raw: string): string {
  let t = raw.trim();
  // Strip wrapping quotes / smart quotes
  t = t.replace(/^["'“‘]|["'”’]$/g, '').trim();
  if (t.length > MAX_TITLE_LEN) t = t.slice(0, MAX_TITLE_LEN);
  return t;
}

export async function generateTitle(
  messages: ModelMessage[],
  settings: AppSettings,
): Promise<string | null> {
  let model;
  try {
    model = createModel(settings);
  } catch {
    return null;
  }

  try {
    const { text } = await generateText({
      model,
      prompt: `${transcriptOf(messages)}\n\n${TITLE_PROMPT}`,
    });
    const cleaned = clean(text);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- title.test
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/taskpane/agent/title.ts src/taskpane/agent/title.test.ts
git commit -m "feat: add LLM-backed title generator with silent fallback"
```

---

## Task 9: HistoryPanel component

**Files:**
- Create: `src/taskpane/components/HistoryPanel.tsx`
- Create: `src/taskpane/components/HistoryPanel.test.tsx`

For UI components we test logic (filter behavior, callbacks), not visual layout.

- [ ] **Step 1: Write failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { HistoryPanel } from './HistoryPanel.tsx';
import type { ConversationSummary } from '../store/history.ts';

const summaries: ConversationSummary[] = [
  { id: 'w1', title: 'Word chat', host: 'word',  createdAt: 1000, updatedAt: 5000, messageCount: 4 },
  { id: 'e1', title: 'Excel chat', host: 'excel', createdAt: 2000, updatedAt: 4000, messageCount: 2 },
  { id: 'w2', title: 'Other Word', host: 'word',  createdAt: 3000, updatedAt: 3000, messageCount: 8 },
];

function renderPanel(overrides: Partial<ComponentProps<typeof HistoryPanel>> = {}) {
  const props = {
    conversations: summaries,
    currentHost: 'word' as const,
    activeId: null,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<HistoryPanel {...props} />);
  return props;
}

describe('HistoryPanel', () => {
  it('defaults to "current host" filter and shows only that host\'s conversations', () => {
    renderPanel();
    expect(screen.getByText('Word chat')).toBeInTheDocument();
    expect(screen.getByText('Other Word')).toBeInTheDocument();
    expect(screen.queryByText('Excel chat')).not.toBeInTheDocument();
  });

  it('"All" filter shows every host', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /all/i }));
    expect(screen.getByText('Word chat')).toBeInTheDocument();
    expect(screen.getByText('Excel chat')).toBeInTheDocument();
  });

  it('"Excel" filter shows only excel conversations', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /excel/i }));
    expect(screen.getByText('Excel chat')).toBeInTheDocument();
    expect(screen.queryByText('Word chat')).not.toBeInTheDocument();
  });

  it('clicking a row fires onSelect with the row id', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByText('Word chat'));
    expect(props.onSelect).toHaveBeenCalledWith('w1');
  });

  it('clicking the close button fires onClose', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows an empty state when there are no conversations', () => {
    renderPanel({ conversations: [] });
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests (expect failure: module not found)**

```bash
npm test -- HistoryPanel.test
```

- [ ] **Step 3: Implement `HistoryPanel.tsx`**

```tsx
import React, { useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Badge,
  Input,
  TabList,
  Tab,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogTrigger,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Edit20Regular,
  Delete20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
} from '@fluentui/react-icons';
import type { ConversationSummary } from '../store/history.ts';
import type { HostKind } from '../host/context.ts';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  filters: {
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  rowActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowTitle: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  rowActions: {
    display: 'flex',
    gap: '2px',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export type HistoryFilter = 'current' | 'all' | HostKind;

export interface HistoryPanelProps {
  conversations: ConversationSummary[];
  currentHost: HostKind;
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function hostLabel(h: HostKind): string {
  return h.charAt(0).toUpperCase() + h.slice(1);
}

export function HistoryPanel({
  conversations,
  currentHost,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onClose,
}: HistoryPanelProps) {
  const styles = useStyles();
  const [filter, setFilter] = useState<HistoryFilter>('current');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const filtered = conversations.filter(c => {
    if (filter === 'current') return c.host === currentHost;
    if (filter === 'all') return true;
    return c.host === filter;
  });

  const startRename = (c: ConversationSummary) => {
    setRenamingId(c.id);
    setRenameDraft(c.title);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      onRename(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          appearance="subtle"
          icon={<ArrowLeft24Regular />}
          onClick={onClose}
          aria-label="Close"
        />
        <Text weight="semibold">History</Text>
      </div>

      <div className={styles.filters}>
        <TabList
          selectedValue={filter}
          onTabSelect={(_, data) => setFilter(data.value as HistoryFilter)}
          size="small"
        >
          <Tab value="current">Current host</Tab>
          <Tab value="all">All</Tab>
          <Tab value="word">Word</Tab>
          <Tab value="excel">Excel</Tab>
        </TabList>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Text>No conversations yet — start chatting to create one.</Text>
          </div>
        ) : filtered.map(c => {
          const isActive = c.id === activeId;
          const isRenaming = renamingId === c.id;
          return (
            <div
              key={c.id}
              className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
              onClick={(e) => {
                if (isRenaming) return;
                if ((e.target as HTMLElement).closest('[data-row-action]')) return;
                onSelect(c.id);
              }}
            >
              <div className={styles.rowMain}>
                {isRenaming ? (
                  <Input
                    value={renameDraft}
                    onChange={(_, d) => setRenameDraft(d.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    autoFocus
                  />
                ) : (
                  <div className={styles.rowTitle}>{c.title}</div>
                )}
                <div className={styles.rowMeta}>
                  <Badge appearance="outline" size="small">{hostLabel(c.host)}</Badge>
                  <span>{relativeTime(c.updatedAt)}</span>
                  <span>·</span>
                  <span>{c.messageCount} msg{c.messageCount === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className={styles.rowActions} data-row-action>
                {isRenaming ? (
                  <>
                    <Button appearance="subtle" size="small" icon={<Checkmark20Regular />} onClick={commitRename} aria-label="Save name" />
                    <Button appearance="subtle" size="small" icon={<Dismiss20Regular />} onClick={cancelRename} aria-label="Cancel rename" />
                  </>
                ) : (
                  <>
                    <Button appearance="subtle" size="small" icon={<Edit20Regular />} onClick={() => startRename(c)} aria-label="Rename" />
                    <Dialog>
                      <DialogTrigger disableButtonEnhancement>
                        <Button appearance="subtle" size="small" icon={<Delete20Regular />} aria-label="Delete" />
                      </DialogTrigger>
                      <DialogSurface>
                        <DialogBody>
                          <DialogTitle>Delete this conversation?</DialogTitle>
                          <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                              <Button appearance="secondary">Cancel</Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                              <Button appearance="primary" onClick={() => onDelete(c.id)}>Delete</Button>
                            </DialogTrigger>
                          </DialogActions>
                        </DialogBody>
                      </DialogSurface>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- HistoryPanel.test
```

- [ ] **Step 5: Run typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/taskpane/components/HistoryPanel.tsx src/taskpane/components/HistoryPanel.test.tsx
git commit -m "feat: add HistoryPanel component with filter, rename, delete"
```

---

## Task 10: CrossHostBanner component + ChatPanel header buttons

**Files:**
- Create: `src/taskpane/components/CrossHostBanner.tsx`
- Modify: `src/taskpane/components/ChatPanel.tsx`

This task is small and visual — no test file. Verify by typecheck + build at the end.

- [ ] **Step 1: Create `CrossHostBanner.tsx`**

```tsx
import React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import type { HostKind } from '../host/context.ts';

const useStyles = makeStyles({
  banner: {
    padding: '6px 12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
});

const display: Record<HostKind, string> = { word: 'Word', excel: 'Excel' };

export function CrossHostBanner({ chatHost, currentHost }: { chatHost: HostKind; currentHost: HostKind }) {
  const styles = useStyles();
  return (
    <div className={styles.banner}>
      <Text size={200}>
        This conversation was started in {display[chatHost]}. You're in {display[currentHost]}. New messages will run against {display[currentHost]}'s APIs.
      </Text>
    </div>
  );
}
```

- [ ] **Step 2: Add header buttons + banner to `ChatPanel.tsx`**

In `src/taskpane/components/ChatPanel.tsx`:

a. Add icon imports (alongside the existing icon imports):

```ts
import {
  Send24Regular,
  Settings24Regular,
  History24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
```

b. Add the `CrossHostBanner` import:

```ts
import { CrossHostBanner } from './CrossHostBanner.tsx';
import type { HostKind } from '../host/context.ts';
```

c. Extend `ChatPanelProps`:

```ts
interface ChatPanelProps {
  host: HostContext;
  messages: ChatMessage[];
  isLoading: boolean;
  pendingApproval: string | null;
  /** Host of the currently-loaded conversation; null = no active conversation. */
  activeChatHost: HostKind | null;
  onSend: (text: string) => void;
  onApprove: (approved: boolean) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onNewChat: () => void;
}
```

d. Update the function signature destructuring to include the new props:

```ts
export function ChatPanel({
  host, messages, isLoading, pendingApproval, activeChatHost,
  onSend, onApprove, onOpenSettings, onOpenHistory, onNewChat,
}: ChatPanelProps) {
```

e. Replace the header `<Tooltip>` block (the one wrapping the settings button) with three buttons:

```tsx
<div style={{ display: 'flex', gap: '4px' }}>
  <Tooltip content="History" relationship="label">
    <Button appearance="subtle" icon={<History24Regular />} onClick={onOpenHistory} disabled={isLoading} />
  </Tooltip>
  <Tooltip content="New chat" relationship="label">
    <Button appearance="subtle" icon={<Add24Regular />} onClick={onNewChat} disabled={isLoading} />
  </Tooltip>
  <Tooltip content="Settings" relationship="label">
    <Button appearance="subtle" icon={<Settings24Regular />} onClick={onOpenSettings} />
  </Tooltip>
</div>
```

f. Render the banner just **after** the header `</div>` and **before** `<div className={styles.messageList}>`:

```tsx
{activeChatHost && activeChatHost !== host.kind && (
  <CrossHostBanner chatHost={activeChatHost} currentHost={host.kind} />
)}
```

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: errors will surface in `App.tsx` because the new required props aren't passed yet. That's expected — Task 11 fixes them. Continue if the only errors are about `ChatPanel` props in `App.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/components/CrossHostBanner.tsx src/taskpane/components/ChatPanel.tsx
git commit -m "feat: add ChatPanel history/new-chat buttons and cross-host banner"
```

---

## Task 11: Wire `App.tsx` — hydrate, persist, title, banner

**Files:**
- Modify: `src/taskpane/App.tsx`

This is the integration task that turns the storage layer + components into a working feature.

- [ ] **Step 1: Replace `App.tsx` in full**

```tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import type { ModelMessage } from 'ai';
import type { HostContext, HostKind } from './host/context.ts';
import { ChatPanel } from './components/ChatPanel.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { runAgent, type ChatMessage, type OrchestratorCallbacks } from './agent/orchestrator.ts';
import { generateTitle } from './agent/title.ts';
import { Sandbox } from './executor/sandbox.ts';
import { loadSettings, saveSettings, type AppSettings } from './store/settings.ts';
import {
  saveConversation,
  getConversation,
  listConversations,
  renameConversation,
  deleteConversation,
  mostRecentForHost,
  type Conversation,
  type ConversationSummary,
} from './store/history.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
});

const SAVE_DEBOUNCE_MS = 300;
const PLACEHOLDER_LEN = 40;

function placeholderTitle(firstUserMessage: string): string {
  const oneLine = firstUserMessage.replace(/\s+/g, ' ').trim();
  if (!oneLine) return 'New chat';
  return oneLine.length <= PLACEHOLDER_LEN ? oneLine : oneLine.slice(0, PLACEHOLDER_LEN);
}

interface AppProps {
  host: HostContext;
}

export function App({ host }: AppProps) {
  const styles = useStyles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeChatHost, setActiveChatHost] = useState<HostKind | null>(null);
  const [historySummaries, setHistorySummaries] = useState<ConversationSummary[]>(() => listConversations());

  const conversationHistory = useRef<ModelMessage[]>([]);
  const sandboxRef = useRef<Sandbox | null>(null);
  const approvalResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate the most recent conversation for this host on mount.
  useEffect(() => {
    const recent = mostRecentForHost(host.kind);
    if (!recent) return;
    const conv = getConversation(recent.id);
    if (!conv) return;
    setMessages(conv.uiMessages);
    conversationHistory.current = conv.modelMessages;
    setActiveConversationId(conv.id);
    setActiveChatHost(conv.host);
  }, [host.kind]);

  useEffect(() => {
    const sandbox = new Sandbox(host.kind);
    sandbox.init();
    sandboxRef.current = sandbox;
    return () => sandbox.destroy();
  }, [host.kind]);

  const refreshSummaries = useCallback(() => {
    setHistorySummaries(listConversations());
  }, []);

  const persistDebounced = useCallback((conv: Conversation) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConversation(conv);
      refreshSummaries();
    }, SAVE_DEBOUNCE_MS);
  }, [refreshSummaries]);

  const persistImmediate = useCallback((conv: Conversation) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveConversation(conv);
    refreshSummaries();
  }, [refreshSummaries]);

  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleApprove = useCallback((approved: boolean) => {
    if (approvalResolveRef.current) {
      approvalResolveRef.current(approved);
      approvalResolveRef.current = null;
      setPendingApproval(null);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    if (isLoading) return;
    setMessages([]);
    conversationHistory.current = [];
    setActiveConversationId(null);
    setActiveChatHost(null);
  }, [isLoading]);

  const handleLoadConversation = useCallback((id: string) => {
    if (isLoading) return;
    const conv = getConversation(id);
    if (!conv) return;
    setMessages(conv.uiMessages);
    conversationHistory.current = conv.modelMessages;
    setActiveConversationId(conv.id);
    setActiveChatHost(conv.host);
    setShowHistory(false);
  }, [isLoading]);

  const handleRename = useCallback((id: string, title: string) => {
    renameConversation(id, title);
    refreshSummaries();
  }, [refreshSummaries]);

  const handleDelete = useCallback((id: string) => {
    deleteConversation(id);
    if (id === activeConversationId) {
      setMessages([]);
      conversationHistory.current = [];
      setActiveConversationId(null);
      setActiveChatHost(null);
    }
    refreshSummaries();
  }, [activeConversationId, refreshSummaries]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Decide on (or create) the active conversation up front so we know its id
    // before runAgent appends new turn messages. Use the latest UI messages
    // captured *before* this user message, so first-turn detection is correct.
    let convId = activeConversationId;
    let convHost: HostKind = activeChatHost ?? host.kind;
    let isFirstTurn = false;
    if (convId === null) {
      convId = crypto.randomUUID();
      convHost = host.kind;
      isFirstTurn = true;
      setActiveConversationId(convId);
      setActiveChatHost(convHost);
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    const callbacks: OrchestratorCallbacks = {
      onMessage: (msg) => setMessages(prev => [...prev, msg]),
      onStreamToken: (token) => {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant' && !last.codeBlock && !last.toolActivity) {
            copy[copy.length - 1] = { ...last, content: last.content + token };
          }
          return copy;
        });
      },
      requestApproval: (code) => {
        setPendingApproval(code);
        return new Promise<boolean>((resolve) => {
          approvalResolveRef.current = resolve;
        });
      },
    };

    // Compute the placeholder title up front so the title-gen block below
    // can rely on it without coordinating with the setMessages callback.
    const placeholder = isFirstTurn ? (placeholderTitle(text) || 'New chat') : '';

    try {
      const history = await runAgent(
        text,
        conversationHistory.current,
        settings,
        sandboxRef.current!,
        host.kind,
        callbacks,
      );
      conversationHistory.current = history;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
      setPendingApproval(null);
    }

    // Snapshot the latest in-memory state by reading back from setState.
    // First-turn saves go through immediately so the blob exists by the
    // time generateTitle resolves; later turns can debounce.
    setMessages(currentMessages => {
      const now = Date.now();
      const existing = isFirstTurn ? null : getConversation(convId!);
      const conv: Conversation = {
        id: convId!,
        v: 1,
        title: isFirstTurn ? placeholder : (existing?.title ?? 'New chat'),
        host: convHost,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messageCount: currentMessages.length,
        uiMessages: currentMessages,
        modelMessages: conversationHistory.current,
      };
      if (isFirstTurn) persistImmediate(conv);
      else persistDebounced(conv);
      return currentMessages;
    });

    // Fire-and-forget LLM title generation on first turn only.
    if (isFirstTurn) {
      void generateTitle(conversationHistory.current, settings).then((newTitle) => {
        if (!newTitle) return;
        const current = getConversation(convId!);
        if (!current) return;
        // Race-safe: only overwrite if the title is still the placeholder we set.
        if (current.title !== placeholder) return;
        renameConversation(convId!, newTitle);
        refreshSummaries();
      });
    }
  }, [isLoading, settings, host, activeConversationId, activeChatHost, persistDebounced, persistImmediate, refreshSummaries]);

  if (showSettings) {
    return (
      <div className={styles.root}>
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className={styles.root}>
        <HistoryPanel
          conversations={historySummaries}
          currentHost={host.kind}
          activeId={activeConversationId}
          onSelect={handleLoadConversation}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <ChatPanel
        host={host}
        messages={messages}
        isLoading={isLoading}
        pendingApproval={pendingApproval}
        activeChatHost={activeChatHost}
        onSend={handleSend}
        onApprove={handleApprove}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: every prior task's tests still passing.

- [ ] **Step 4: Run a production build**

```bash
npm run build
```

Expected: build succeeds with no TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/App.tsx
git commit -m "feat: persist chat history with auto-title and history panel"
```

---

## Task 12: Manual smoke verification

This task is verification only — no code changes. Skip individual commits; the goal is to catch UX bugs the unit tests can't.

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

(If running headless, do `npm run start` to sideload into Word — same outcome for these tests.)

- [ ] **Step 2: Verify reload-survives-chat**

1. Open the task pane in Word (or visit `https://localhost:3721` directly).
2. Send a message that produces a `codeBlock` (e.g. `"Make all headings blue"`).
3. Reload the page (Ctrl+R). The conversation should reappear, including the code block with its `success`/`error` status preserved.

- [ ] **Step 3: Verify multi-conversation switching**

1. With one conversation in place, click the **New chat** (plus) button.
2. Send a different message.
3. Click **History** (clock). Verify both conversations are listed, newest first.
4. Click the older one. The chat content swaps to that conversation. The active row is highlighted.

- [ ] **Step 4: Verify rename and delete**

1. In the History panel, click the rename (pencil) icon on a conversation. Edit and press Enter. The title updates immediately.
2. Click delete (trash). Confirm. The row disappears.
3. Reload. The deleted conversation does not return.

- [ ] **Step 5: Verify host filter**

1. Sideload Excel: `npm run sideload:excel` in another terminal.
2. Send a message in Excel.
3. Open History. Default filter "Current host" → only the Excel chat shown.
4. Click "All" → both Word and Excel chats shown.
5. Click the Word chat → the cross-host banner appears above the chat. Send a message → the orchestrator runs against Excel APIs (banner content states this).

- [ ] **Step 6: Verify LLM title**

1. With a valid API key configured in settings, start a new chat. Send something topical (e.g. *"Make a chart from B2:D8"*).
2. Open History. Within ~5s, the title should change from the truncated placeholder (e.g. "Make a chart from B2:D8") to a model-generated label (e.g. "Build Range Chart").
3. Repeat with **no** API key. Verify the placeholder stays — silent fallback.

- [ ] **Step 7: Verify rename-during-title-gen race**

1. Start a new chat. Quickly rename it before the LLM call returns. The model-generated title should NOT overwrite your manual rename.

- [ ] **Step 8: Update the README roadmap**

Open `README.md`, find the `## Roadmap > ### Chat History` section, and remove or strike the items now shipped (persist conversation, named conversations, history panel). Leave only the export item.

- [ ] **Step 9: Commit the README update**

```bash
git add README.md
git commit -m "docs: update README roadmap — chat history persistence shipped"
```

- [ ] **Step 10: Final verification**

```bash
npm test
npx tsc --noEmit
npm run build
```

All three must pass. If any fail, fix before declaring complete.

---

## Self-review summary

**Spec coverage:**
- Storage backend (localStorage only) → Tasks 2-7.
- Data model (Conversation / ConversationSummary, both message arrays) → Task 2.
- Title derivation (placeholder + LLM async) → Tasks 8 & 11.
- History panel UX (filter chips, list, rename, delete) → Task 9.
- Cross-host banner → Task 10.
- Startup / new-chat behavior → Task 11.
- Loading guard (disable history actions while turn in flight) → Task 11 (`isLoading` checks in `handleNewChat`/`handleLoadConversation`) + Task 10 (header buttons disabled).
- Persistence triggers (first-message create, end-of-turn debounced save, immediate rename/delete) → Task 11.
- Eviction + per-conversation truncation + quota retry → Task 6.
- Schema versioning → Task 7.
- Error & edge handling (corrupt blob, unknown v, race) → Tasks 3 (corrupt), 7 (unknown v), 11 (race guard).
- Testing — unit tests + manual smoke list → Tasks 2-9 + Task 12.

**Out-of-spec items added:**
- README roadmap update (Task 12 step 8) — small docs hygiene.

No placeholders, no `TBD`, every code step has complete code.
