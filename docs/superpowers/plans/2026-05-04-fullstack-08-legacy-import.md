# Local full-stack — Plan 08: Legacy data import

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On first launch after upgrade, detect existing AutoOffice data in `Office.context.roamingSettings` (provider/model/MCP/auto-approve/locale) and `localStorage` (chat history) and import it into the server's SQLite via a one-off `/api/import-legacy` endpoint, then clear the old storage. The migration is opt-in (a modal asks before sending).

**Architecture:** Frontend reads the legacy keys exactly as the previous version wrote them; if any are non-empty, render a one-click migration modal. On click it POSTs `{ settings, conversations, providers? }` to `/api/import-legacy`. The server validates, replaces empty rows / appends conversations, and returns counts. The frontend then clears legacy keys. The endpoint is rate-limited to one call per fresh database (`settings` table count must be 0 to permit imports of settings; conversations always merge).

**Tech Stack:** AI SDK persistence types, zod, Office.js `roamingSettings`, `localStorage`, vitest + RTL.

**Branch:** `feat/local-fullstack` (continued)

**Spec:** `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design.md` — see "Frontend changes → Legacy data import".

---

## File structure after this plan

```
apps/server/src/
├── routes/
│   ├── import-legacy.ts                NEW
│   └── import-legacy.test.ts           NEW

packages/shared/src/schemas/
├── legacy-import.ts                    NEW
└── index.ts                            MODIFIED

apps/web/src/taskpane/
├── legacy/
│   ├── detect.ts                       NEW
│   ├── detect.test.ts                  NEW
│   ├── pack.ts                         NEW (re-shape into LegacyImportPayload)
│   └── pack.test.ts                    NEW
├── components/
│   ├── LegacyImportModal.tsx           NEW
│   └── LegacyImportModal.test.tsx      NEW
└── App.tsx                             MODIFIED (mount the modal)
```

---

## Task 1: `LegacyImportPayload` schema

**Files:**
- Create: `packages/shared/src/schemas/legacy-import.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: Schema**

`packages/shared/src/schemas/legacy-import.ts`:
```ts
import { z } from 'zod';
import { SettingsSchema } from './settings';
import { HostSchema, MessageSchema } from './conversation';

export const LegacyConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  host: HostSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  messages: z.array(MessageSchema.partial({ conversationId: true })).default([]),
});

export const LegacyImportPayloadSchema = z.object({
  settings: SettingsSchema.partial().nullish(),
  conversations: z.array(LegacyConversationSchema).default([]),
  // Provider / MCP not migrated automatically: API keys aren't recoverable across the
  // crypto boundary, and CLI-bridge providers have to be re-added with their CLI auth.
});
export type LegacyImportPayload = z.infer<typeof LegacyImportPayloadSchema>;

export const LegacyImportResultSchema = z.object({
  importedSettings: z.boolean(),
  importedConversationCount: z.number().int(),
  importedMessageCount: z.number().int(),
  skippedReason: z.string().nullable(),
});
export type LegacyImportResult = z.infer<typeof LegacyImportResultSchema>;
```

- [ ] **Step 2: Re-export**

Append to `packages/shared/src/schemas/index.ts`:
```ts
export * from './legacy-import';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/schemas
git commit -m "feat(shared): LegacyImportPayload + result schemas"
```

---

## Task 2: `/api/import-legacy` route

**Files:**
- Create: `apps/server/src/routes/import-legacy.test.ts`
- Create: `apps/server/src/routes/import-legacy.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Failing test**

`apps/server/src/routes/import-legacy.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

const TOKEN = 'tok';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

describe('/api/import-legacy', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 't', db, authToken: TOKEN });
  });

  it('imports settings on a fresh db', async () => {
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ settings: { autoApprove: true, locale: 'he' } }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.importedSettings).toBe(true);
    const s = await (await app.request('/api/settings', { headers: auth })).json();
    expect(s.autoApprove).toBe(true);
    expect(s.locale).toBe('he');
  });

  it('skips settings if already non-default', async () => {
    await app.request('/api/settings', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ autoApprove: true }),
    });
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ settings: { autoApprove: false } }),
    });
    const body = await r.json();
    expect(body.importedSettings).toBe(false);
    expect(body.skippedReason).toMatch(/settings already exist/i);
  });

  it('imports conversations and messages', async () => {
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        conversations: [
          {
            id: 'c_legacy_1',
            title: 'Old chat',
            host: 'word',
            createdAt: 1,
            updatedAt: 2,
            messages: [
              { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }], metadata: null, createdAt: 1 },
              { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'hey' }], metadata: null, createdAt: 2 },
            ],
          },
        ],
      }),
    });
    const body = await r.json();
    expect(body.importedConversationCount).toBe(1);
    expect(body.importedMessageCount).toBe(2);

    const list = await (await app.request('/api/conversations', { headers: auth })).json();
    expect(list).toHaveLength(1);
    const detail = await (await app.request(`/api/conversations/${list[0].id}`, { headers: auth })).json();
    expect(detail.messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
  });

  it('rejects malformed payloads with 400', async () => {
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ conversations: [{ id: 'x' }] }),
    });
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npm --workspace @autooffice/server run test -- src/routes/import-legacy.test.ts
```

- [ ] **Step 3: Implement**

`apps/server/src/routes/import-legacy.ts`:
```ts
import { Hono } from 'hono';
import {
  DEFAULT_SETTINGS,
  LegacyImportPayloadSchema,
  LegacyImportResultSchema,
} from '@autooffice/shared';
import type { SettingsRepo } from '../db/settings';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';

export function importLegacyRouter(deps: {
  settings: SettingsRepo;
  conversations: ConversationsRepo;
  messages: MessagesRepo;
}) {
  const r = new Hono();

  r.post('/', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = LegacyImportPayloadSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const payload = parsed.data;

    let importedSettings = false;
    let skippedReason: string | null = null;

    if (payload.settings) {
      const cur = deps.settings.get();
      const isDefault = JSON.stringify(cur) === JSON.stringify(DEFAULT_SETTINGS);
      if (isDefault) {
        deps.settings.update(payload.settings);
        importedSettings = true;
      } else {
        skippedReason = 'settings already exist';
      }
    }

    let importedConversationCount = 0;
    let importedMessageCount = 0;
    for (const lc of payload.conversations) {
      const id = deps.conversations.create({
        host: lc.host,
        title: lc.title ?? null,
      });
      const msgs = lc.messages.map((m) => ({
        id: m.id ?? `msg_legacy_${Math.random().toString(36).slice(2)}`,
        conversationId: id,
        role: m.role ?? 'user',
        parts: (m.parts ?? []) as unknown[],
        metadata: m.metadata ?? null,
      }));
      if (msgs.length > 0) deps.messages.replaceAll(id, msgs);
      importedConversationCount += 1;
      importedMessageCount += msgs.length;
    }

    return c.json(
      LegacyImportResultSchema.parse({
        importedSettings,
        importedConversationCount,
        importedMessageCount,
        skippedReason,
      }),
    );
  });

  return r;
}
```

- [ ] **Step 4: Wire into `app.ts`**

Add the import + the route in `createApp`:
```ts
import { importLegacyRouter } from './routes/import-legacy';
// …
app.route('/api/import-legacy', importLegacyRouter({ settings, conversations, messages }));
```

- [ ] **Step 5: Run tests, confirm passing**

```bash
npm --workspace @autooffice/server run test -- src/routes/import-legacy.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/server/src
git commit -m "feat(server): /api/import-legacy migrates settings + conversations"
```

---

## Task 3: Frontend — `legacy/detect.ts` and `legacy/pack.ts`

**Files:**
- Create: `apps/web/src/taskpane/legacy/detect.ts`
- Create: `apps/web/src/taskpane/legacy/detect.test.ts`
- Create: `apps/web/src/taskpane/legacy/pack.ts`
- Create: `apps/web/src/taskpane/legacy/pack.test.ts`

- [ ] **Step 1: detect.ts** — read whatever the previous version stored

`apps/web/src/taskpane/legacy/detect.ts`:
```ts
export type LegacyBlob = {
  roamingSettingsRaw: Record<string, unknown> | null;
  localStorageConvs: unknown[] | null;
};

export function detectLegacy(): LegacyBlob {
  const roamingSettingsRaw = readRoamingSettings();
  const localStorageConvs = readLocalStorageConvs();
  return { roamingSettingsRaw, localStorageConvs };
}

export function clearLegacy(): void {
  for (const k of LEGACY_LS_KEYS) {
    try { window.localStorage.removeItem(k); } catch { /* noop */ }
  }
  try {
    const rs = (Office as any)?.context?.roamingSettings;
    if (rs?.remove) {
      for (const k of LEGACY_RS_KEYS) rs.remove(k);
      rs.saveAsync?.(() => {});
    }
  } catch { /* noop */ }
}

const LEGACY_LS_KEYS = ['autoOffice.conversations', 'autoOffice.activeConversationId'];
const LEGACY_RS_KEYS = ['autoOffice.settings', 'autoOffice.providers', 'autoOffice.mcpServers'];

function readRoamingSettings(): Record<string, unknown> | null {
  try {
    const rs = (Office as any)?.context?.roamingSettings;
    if (!rs?.get) return null;
    const out: Record<string, unknown> = {};
    let hit = 0;
    for (const k of LEGACY_RS_KEYS) {
      const v = rs.get(k);
      if (v != null) { out[k] = v; hit += 1; }
    }
    return hit === 0 ? null : out;
  } catch {
    return null;
  }
}

function readLocalStorageConvs(): unknown[] | null {
  try {
    const raw = window.localStorage.getItem('autoOffice.conversations');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: detect.test.ts**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectLegacy, clearLegacy } from './detect';

beforeEach(() => {
  (window as any).localStorage = {
    _s: new Map<string, string>(),
    getItem(k: string) { return this._s.get(k) ?? null; },
    setItem(k: string, v: string) { this._s.set(k, v); },
    removeItem(k: string) { this._s.delete(k); },
    clear() { this._s.clear(); },
  };
  (globalThis as any).Office = undefined;
});

describe('detectLegacy', () => {
  it('returns nulls when nothing is stored', () => {
    const r = detectLegacy();
    expect(r.roamingSettingsRaw).toBeNull();
    expect(r.localStorageConvs).toBeNull();
  });

  it('reads localStorage conversations', () => {
    window.localStorage.setItem('autoOffice.conversations', JSON.stringify([{ id: 'x' }]));
    const r = detectLegacy();
    expect(r.localStorageConvs).toEqual([{ id: 'x' }]);
  });

  it('reads roamingSettings entries', () => {
    (globalThis as any).Office = { context: { roamingSettings: {
      get: (k: string) => (k === 'autoOffice.settings' ? { autoApprove: true } : null),
    } } };
    const r = detectLegacy();
    expect(r.roamingSettingsRaw).toEqual({ 'autoOffice.settings': { autoApprove: true } });
  });
});

describe('clearLegacy', () => {
  it('removes the localStorage keys', () => {
    window.localStorage.setItem('autoOffice.conversations', '[]');
    clearLegacy();
    expect(window.localStorage.getItem('autoOffice.conversations')).toBeNull();
  });
});
```

- [ ] **Step 3: pack.ts** — convert legacy blob to `LegacyImportPayload`

`apps/web/src/taskpane/legacy/pack.ts`:
```ts
import type { LegacyImportPayload } from '@shared';
import type { LegacyBlob } from './detect';

export function pack(blob: LegacyBlob): LegacyImportPayload | null {
  const settingsRaw = blob.roamingSettingsRaw?.['autoOffice.settings'] as Record<string, unknown> | undefined;
  const settings = settingsRaw
    ? {
        locale: typeof settingsRaw.locale === 'string' ? settingsRaw.locale : undefined,
        autoApprove: typeof settingsRaw.autoApprove === 'boolean' ? settingsRaw.autoApprove : undefined,
        maxSteps: typeof settingsRaw.maxSteps === 'number' ? settingsRaw.maxSteps : undefined,
      }
    : undefined;

  const conversations = (blob.localStorageConvs ?? []).map((c: any, idx: number) => ({
    id: typeof c.id === 'string' ? c.id : `c_legacy_${idx}`,
    title: typeof c.title === 'string' ? c.title : null,
    host: (c.host === 'excel' || c.host === 'powerpoint') ? c.host : 'word',
    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
    messages: Array.isArray(c.messages) ? c.messages : [],
  }));

  if (!settings && conversations.length === 0) return null;
  return { settings, conversations };
}
```

- [ ] **Step 4: pack.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { pack } from './pack';

describe('pack', () => {
  it('returns null on an empty blob', () => {
    expect(pack({ roamingSettingsRaw: null, localStorageConvs: null })).toBeNull();
  });

  it('extracts settings + conversations', () => {
    const out = pack({
      roamingSettingsRaw: { 'autoOffice.settings': { locale: 'he', autoApprove: true } },
      localStorageConvs: [{ id: 'c1', title: 'T', host: 'word', messages: [] }],
    });
    expect(out!.settings).toEqual({ locale: 'he', autoApprove: true });
    expect(out!.conversations).toHaveLength(1);
  });

  it('defaults host to word for unknown values', () => {
    const out = pack({
      roamingSettingsRaw: null,
      localStorageConvs: [{ id: 'c1', host: 'outlook', messages: [] }],
    });
    expect(out!.conversations[0].host).toBe('word');
  });
});
```

- [ ] **Step 5: Run, confirm passing**

```bash
npm --workspace @autooffice/web run test -- src/taskpane/legacy
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/taskpane/legacy
git commit -m "feat(web/legacy): detect + pack pre-migration data into LegacyImportPayload"
```

---

## Task 4: Migration modal

**Files:**
- Create: `apps/web/src/taskpane/components/LegacyImportModal.tsx`
- Create: `apps/web/src/taskpane/components/LegacyImportModal.test.tsx`

- [ ] **Step 1: Component**

`apps/web/src/taskpane/components/LegacyImportModal.tsx`:
```tsx
import React, { useState } from 'react';
import type { LegacyImportPayload, LegacyImportResult } from '@shared';
import { apiSend } from '../api';
import { clearLegacy } from '../legacy/detect';

type Props = {
  payload: LegacyImportPayload;
  onDone: () => void;
};

export function LegacyImportModal({ payload, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = `${payload.conversations.length} conversation(s)` +
    (payload.settings ? ', settings' : '');

  async function migrate() {
    setBusy(true);
    setError(null);
    try {
      await apiSend<LegacyImportResult>('/api/import-legacy', payload);
      clearLegacy();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-label="Import previous AutoOffice data" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: 'var(--colorNeutralBackground1)', padding: 16, maxWidth: 320, borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Import previous AutoOffice data?</h2>
        <p>We found data from an earlier version: {summary}.</p>
        <p>Click Import to copy it into the local server. Click Skip to start fresh.</p>
        {error && <p style={{ color: 'var(--colorPaletteRedForeground1)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onDone} disabled={busy}>Skip</button>
          <button onClick={migrate} disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test**

`apps/web/src/taskpane/components/LegacyImportModal.test.tsx`:
```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LegacyImportModal } from './LegacyImportModal';

beforeEach(() => {
  (globalThis as any).fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
});

describe('LegacyImportModal', () => {
  it('shows the summary and Skip dismisses', () => {
    const onDone = vi.fn();
    render(<LegacyImportModal payload={{ conversations: [], settings: { autoApprove: true } } as any} onDone={onDone} />);
    expect(screen.getByText(/import previous/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Skip'));
    expect(onDone).toHaveBeenCalled();
  });

  it('Import calls /api/import-legacy then onDone', async () => {
    const onDone = vi.fn();
    render(<LegacyImportModal payload={{ conversations: [], settings: { autoApprove: true } } as any} onDone={onDone} />);
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run, confirm passing**

```bash
npm --workspace @autooffice/web run test -- src/taskpane/components/LegacyImportModal.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/taskpane/components
git commit -m "feat(web): LegacyImportModal — opt-in data migration"
```

---

## Task 5: Mount the modal in `App.tsx`

**Files:**
- Modify: `apps/web/src/taskpane/App.tsx`

- [ ] **Step 1: Detect, pack, and render**

In `App.tsx`'s top-level `App` component, after the bootstrap effect, add:
```tsx
const [pendingLegacy, setPendingLegacy] = useState<ReturnType<typeof pack> | null>(null);

useEffect(() => {
  const blob = detectLegacy();
  setPendingLegacy(pack(blob));
}, []);

// in the render, before returning ChatScreen:
if (pendingLegacy) {
  return <LegacyImportModal payload={pendingLegacy} onDone={() => setPendingLegacy(null)} />;
}
```

Add the imports:
```tsx
import { detectLegacy } from './legacy/detect';
import { pack } from './legacy/pack';
import { LegacyImportModal } from './components/LegacyImportModal';
```

- [ ] **Step 2: Build and run**

```bash
npm --workspace @autooffice/web run build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/taskpane/App.tsx
git commit -m "feat(web): mount LegacyImportModal on first launch when legacy data found"
```

---

## Task 6: Coverage and full-suite green

**Files:** None.

- [ ] **Step 1: Run all tests with coverage**

```bash
npm run test
```

- [ ] **Step 2: Push branch**

```bash
git push
```

CI must remain green.

---

## Self-review (silent — fix inline)

- [x] Spec coverage: detect → pack → modal → POST → clear, server-side validate + import — all present.
- [x] No TODO/TBD placeholders.
- [x] Provider keys are explicitly NOT migrated (would require crossing the crypto boundary). Documented in the schema comments.
- [x] Settings import is gated by "settings still default" so a re-run can't blow away the user's new config.
- [x] No references to identifiers from later plans.
