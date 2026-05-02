# Excel Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AutoOffice from a Word-only add-in to a single multi-host add-in that also runs in Excel, with full per-host skill parity (21 Excel skill markdown files), runtime host detection, host-aware sandbox/orchestrator/system-prompt, and a host indicator badge in the task pane.

**Architecture:** A single `HostContext` module resolves `Office.context.host` once at startup, then is plumbed top-down. `Sandbox`, `lookupSkill`, and the agent system prompt all branch on it. Skills live in `src/taskpane/skills/word/` and `src/taskpane/skills/excel/`. The same multi-host `manifest.xml` declares both `Document` and `Workbook` hosts; one Add-in ID, one task pane URL, one installer.

**Tech Stack:** React 19 + TypeScript, Vite, Fluent UI v9, Vercel AI SDK, office.js (Word + Excel), office-addin-debugging.

**Verification model:** This project has no automated test framework. Per-task verification gates are:
- **`npm run build`** (runs `tsc && vite build`) — TypeScript + bundler must succeed
- **Manual smoke test** in Word and/or Excel at host-touching milestones

Smoke test = sideload, open task pane, send a one-line command (e.g. "make the first paragraph bold" / "put 'hello' in A1"), watch the agent look up a skill, generate code, execute it, and confirm the document changed. Regression smoke = the same test in Word still works.

**Spec:** `docs/superpowers/specs/2026-05-01-excel-support-design.md`

---

## File Structure

**New files:**
- `src/taskpane/host/context.ts` — `HostKind` type, `HostContext`, `detectHost()`
- `src/taskpane/agent/system-prompt.ts` — `buildSystemPrompt(host, skills)`
- `src/taskpane/skills/word/index.ts` — Word skill registry
- `src/taskpane/skills/excel/index.ts` — Excel skill registry
- `src/taskpane/skills/excel/*.md` — 21 Excel skill markdown files (see Phase 6)

**Moved files:**
- `src/taskpane/skills/{19 .md files}` → `src/taskpane/skills/word/{same names}` (no content edits)

**Modified files:**
- `src/taskpane/skills/index.ts` — host-aware `lookupSkill(host, name)` and `listSkills(host)`
- `src/taskpane/agent/tools.ts` — convert `lookupSkillTool` singleton to `makeLookupSkillTool(host)` factory
- `src/taskpane/agent/orchestrator.ts` — accept `host` param, build prompt dynamically, use tool factories
- `src/taskpane/executor/sandbox.ts` — accept `host` in constructor, branch `Word.run`/`Excel.run` wrapping
- `src/taskpane/executor/iframe.html` — parallel host-aware wrapping (legacy path, future-proof)
- `src/taskpane/App.tsx` — pass `HostContext` to Sandbox + orchestrator
- `src/taskpane/index.tsx` — call `detectHost()` and pass into `App`; render fatal-error screen on unsupported host
- `src/taskpane/components/ChatPanel.tsx` — add host badge next to title
- `manifest.xml` — add `Workbook` to `Hosts`; add second `Host xsi:type="Workbook"` block in `VersionOverrides`
- `manifest.production.xml` — same multi-host changes
- `package.json` — add `start:excel` and `sideload:excel` npm scripts
- `installer/setup.iss` — update display copy from "Word add-in" → "Word & Excel add-in"
- `installer/autooffice.nsi` — same display copy update if present
- `README.md` — title, comparison table description, prerequisites, settings-shared note

---

## Phase 1 — Host detection foundation (no behavior change)

### Task 1: Create `HostContext` module

**Files:**
- Create: `src/taskpane/host/context.ts`

- [ ] **Step 1: Create the file**

```ts
// src/taskpane/host/context.ts
export type HostKind = 'word' | 'excel';

export interface HostContext {
  kind: HostKind;
  displayName: string;
}

export class UnsupportedHostError extends Error {
  constructor(actual: string) {
    super(`AutoOffice does not support this Office host: ${actual}`);
    this.name = 'UnsupportedHostError';
  }
}

export function detectHost(): HostContext {
  if (typeof Office === 'undefined' || !Office.context) {
    // Dev mode (vite preview, no Office). Default to Word so the existing
    // Word-only dev experience keeps working when you visit the URL directly.
    return { kind: 'word', displayName: 'Word' };
  }
  switch (Office.context.host) {
    case Office.HostType.Word:
      return { kind: 'word', displayName: 'Word' };
    case Office.HostType.Excel:
      return { kind: 'excel', displayName: 'Excel' };
    default:
      throw new UnsupportedHostError(String(Office.context.host));
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds, no TS errors. (No callers yet — this just confirms the file compiles.)

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/host/context.ts
git commit -m "Add HostContext module for runtime Word/Excel detection"
```

---

### Task 2: Wire `HostContext` through `index.tsx` → `App`

**Files:**
- Modify: `src/taskpane/index.tsx`
- Modify: `src/taskpane/App.tsx`

- [ ] **Step 1: Update `index.tsx` to call `detectHost` and handle unsupported hosts**

Replace the current `index.tsx` body:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme, Text } from '@fluentui/react-components';
import { App } from './App.tsx';
import { detectHost, UnsupportedHostError, type HostContext } from './host/context.ts';

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

function renderApp(host: HostContext) {
  root.render(
    <FluentProvider theme={webLightTheme}>
      <App host={host} />
    </FluentProvider>
  );
}

function renderFatal(message: string) {
  root.render(
    <FluentProvider theme={webLightTheme}>
      <div style={{ padding: '24px' }}>
        <Text size={400} weight="semibold">AutoOffice cannot start</Text>
        <p>{message}</p>
      </div>
    </FluentProvider>
  );
}

function start() {
  try {
    renderApp(detectHost());
  } catch (e) {
    if (e instanceof UnsupportedHostError) {
      renderFatal(e.message);
    } else {
      renderFatal(e instanceof Error ? e.message : String(e));
    }
  }
}

if (typeof Office !== 'undefined') {
  Office.onReady(() => start());
} else {
  start();
}
```

- [ ] **Step 2: Add `host` prop to `App` (no behavior change yet — just plumbing)**

In `src/taskpane/App.tsx`, change the component signature:

```tsx
import type { HostContext } from './host/context.ts';

interface AppProps {
  host: HostContext;
}

export function App({ host }: AppProps) {
  // ...existing body unchanged for now; we'll consume `host` in later tasks
  // Suppress unused-prop warning by reading it in a comment-free way:
  void host;
  // ...rest of existing body
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Smoke test in Word (no regression)**

Run: `npm run sideload`
Open AutoOffice in Word. Send "make the first paragraph bold". Confirm the agent generates and runs Word code as before.
Expected: identical behavior to before this task.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/index.tsx src/taskpane/App.tsx
git commit -m "Plumb HostContext from index.tsx into App"
```

---

## Phase 2 — Skill registry restructure (no behavior change)

### Task 3: Move Word skill markdown into `skills/word/`

**Files:**
- Move (no edits): all 19 `.md` files in `src/taskpane/skills/` → `src/taskpane/skills/word/`

- [ ] **Step 1: Move the files**

```bash
mkdir -p src/taskpane/skills/word
git mv src/taskpane/skills/bookmarks.md          src/taskpane/skills/word/bookmarks.md
git mv src/taskpane/skills/comments.md           src/taskpane/skills/word/comments.md
git mv src/taskpane/skills/content-controls.md   src/taskpane/skills/word/content-controls.md
git mv src/taskpane/skills/context-sync.md       src/taskpane/skills/word/context-sync.md
git mv src/taskpane/skills/document.md           src/taskpane/skills/word/document.md
git mv src/taskpane/skills/fields.md             src/taskpane/skills/word/fields.md
git mv src/taskpane/skills/footnotes.md          src/taskpane/skills/word/footnotes.md
git mv src/taskpane/skills/formatting.md         src/taskpane/skills/word/formatting.md
git mv src/taskpane/skills/headers-footers.md    src/taskpane/skills/word/headers-footers.md
git mv src/taskpane/skills/hyperlinks.md         src/taskpane/skills/word/hyperlinks.md
git mv src/taskpane/skills/images.md             src/taskpane/skills/word/images.md
git mv src/taskpane/skills/lists.md              src/taskpane/skills/word/lists.md
git mv src/taskpane/skills/ooxml.md              src/taskpane/skills/word/ooxml.md
git mv src/taskpane/skills/page-setup.md         src/taskpane/skills/word/page-setup.md
git mv src/taskpane/skills/ranges.md             src/taskpane/skills/word/ranges.md
git mv src/taskpane/skills/search.md             src/taskpane/skills/word/search.md
git mv src/taskpane/skills/styles.md             src/taskpane/skills/word/styles.md
git mv src/taskpane/skills/tables.md             src/taskpane/skills/word/tables.md
git mv src/taskpane/skills/track-changes.md      src/taskpane/skills/word/track-changes.md
```

- [ ] **Step 2: Update import paths in `src/taskpane/skills/index.ts`**

Change every `import X from './X.md?raw';` to `import X from './word/X.md?raw';`. Replace the file contents:

```ts
// src/taskpane/skills/index.ts
import contextSync       from './word/context-sync.md?raw';
import formatting        from './word/formatting.md?raw';
import tables            from './word/tables.md?raw';
import contentControls   from './word/content-controls.md?raw';
import styles            from './word/styles.md?raw';
import ranges            from './word/ranges.md?raw';
import search            from './word/search.md?raw';
import comments          from './word/comments.md?raw';
import headersFooters    from './word/headers-footers.md?raw';
import images            from './word/images.md?raw';
import lists             from './word/lists.md?raw';
import documentSkill     from './word/document.md?raw';
import bookmarks         from './word/bookmarks.md?raw';
import hyperlinks        from './word/hyperlinks.md?raw';
import footnotes         from './word/footnotes.md?raw';
import fields            from './word/fields.md?raw';
import trackChanges      from './word/track-changes.md?raw';
import pageSetup         from './word/page-setup.md?raw';
import ooxml             from './word/ooxml.md?raw';

const SKILLS: Record<string, string> = {
  'context-sync': contextSync,
  'formatting': formatting,
  'tables': tables,
  'content-controls': contentControls,
  'styles': styles,
  'ranges': ranges,
  'search': search,
  'comments': comments,
  'headers-footers': headersFooters,
  'images': images,
  'lists': lists,
  'document': documentSkill,
  'bookmarks': bookmarks,
  'hyperlinks': hyperlinks,
  'footnotes': footnotes,
  'fields': fields,
  'track-changes': trackChanges,
  'page-setup': pageSetup,
  'ooxml': ooxml,
};

export const SKILL_NAMES = [
  'formatting', 'tables', 'content-controls', 'styles',
  'ranges', 'search', 'comments', 'headers-footers',
  'images', 'lists', 'document', 'context-sync',
  'bookmarks', 'hyperlinks', 'footnotes', 'fields',
  'track-changes', 'page-setup', 'ooxml',
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

export function lookupSkill(name: SkillName): string {
  const content = SKILLS[name];
  if (!content) {
    return `Skill "${name}" not found. Available skills: ${SKILL_NAMES.join(', ')}`;
  }
  return content;
}
```

(This is a temporary shape — Task 4 turns it into a host-aware API. Splitting the move from the API change keeps each commit small.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success. Imports resolve from new paths.

- [ ] **Step 4: Smoke test in Word**

Run: `npm run sideload`. Send a request that triggers a skill lookup (e.g. "insert a 3-column table"). Confirm the agent fetches the `tables` skill and code runs.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/skills/
git commit -m "Move Word skill markdown into skills/word/ subfolder"
```

---

### Task 4: Make `skills/index.ts` host-aware

**Files:**
- Create: `src/taskpane/skills/excel/index.ts` (registry shell, empty for now)
- Modify: `src/taskpane/skills/index.ts`

- [ ] **Step 1: Create empty Excel registry**

```ts
// src/taskpane/skills/excel/index.ts
export const EXCEL_SKILL_NAMES = [] as const;
export type ExcelSkillName = (typeof EXCEL_SKILL_NAMES)[number];
export const EXCEL_SKILLS: Record<string, string> = {};
```

(Phase 6 fills this in as each Excel skill is authored.)

- [ ] **Step 2: Move Word registry into `skills/word/index.ts`**

```ts
// src/taskpane/skills/word/index.ts
import contextSync       from './context-sync.md?raw';
import formatting        from './formatting.md?raw';
import tables            from './tables.md?raw';
import contentControls   from './content-controls.md?raw';
import styles            from './styles.md?raw';
import ranges            from './ranges.md?raw';
import search            from './search.md?raw';
import comments          from './comments.md?raw';
import headersFooters    from './headers-footers.md?raw';
import images            from './images.md?raw';
import lists             from './lists.md?raw';
import documentSkill     from './document.md?raw';
import bookmarks         from './bookmarks.md?raw';
import hyperlinks        from './hyperlinks.md?raw';
import footnotes         from './footnotes.md?raw';
import fields            from './fields.md?raw';
import trackChanges      from './track-changes.md?raw';
import pageSetup         from './page-setup.md?raw';
import ooxml             from './ooxml.md?raw';

export const WORD_SKILL_NAMES = [
  'formatting', 'tables', 'content-controls', 'styles',
  'ranges', 'search', 'comments', 'headers-footers',
  'images', 'lists', 'document', 'context-sync',
  'bookmarks', 'hyperlinks', 'footnotes', 'fields',
  'track-changes', 'page-setup', 'ooxml',
] as const;

export type WordSkillName = (typeof WORD_SKILL_NAMES)[number];

export const WORD_SKILLS: Record<string, string> = {
  'context-sync': contextSync, 'formatting': formatting, 'tables': tables,
  'content-controls': contentControls, 'styles': styles, 'ranges': ranges,
  'search': search, 'comments': comments, 'headers-footers': headersFooters,
  'images': images, 'lists': lists, 'document': documentSkill,
  'bookmarks': bookmarks, 'hyperlinks': hyperlinks, 'footnotes': footnotes,
  'fields': fields, 'track-changes': trackChanges, 'page-setup': pageSetup,
  'ooxml': ooxml,
};
```

- [ ] **Step 3: Replace `src/taskpane/skills/index.ts` with the host-aware façade**

```ts
// src/taskpane/skills/index.ts
import type { HostKind } from '../host/context.ts';
import { WORD_SKILLS, WORD_SKILL_NAMES } from './word/index.ts';
import { EXCEL_SKILLS, EXCEL_SKILL_NAMES } from './excel/index.ts';

export function listSkills(host: HostKind): readonly string[] {
  return host === 'word' ? WORD_SKILL_NAMES : EXCEL_SKILL_NAMES;
}

export function lookupSkill(host: HostKind, name: string): string {
  const table = host === 'word' ? WORD_SKILLS : EXCEL_SKILLS;
  const content = table[name];
  if (!content) {
    const available = listSkills(host).join(', ');
    return `Skill "${name}" not found for host "${host}". Available: ${available}`;
  }
  return content;
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: TS errors in `tools.ts` (which still calls the old `lookupSkill(name)` and imports `SKILL_NAMES`). That's expected — Task 5 fixes them.

- [ ] **Step 5: Do NOT commit yet — proceed to Task 5 to keep the build green**

---

### Task 5: Convert `tools.ts` to factory + update orchestrator to pass host

**Files:**
- Modify: `src/taskpane/agent/tools.ts`
- Modify: `src/taskpane/agent/orchestrator.ts`
- Modify: `src/taskpane/App.tsx`

- [ ] **Step 1: Replace `tools.ts`**

```ts
// src/taskpane/agent/tools.ts
import { tool, jsonSchema } from 'ai';
import { lookupSkill, listSkills } from '../skills/index.ts';
import type { HostKind } from '../host/context.ts';

export function makeLookupSkillTool(host: HostKind) {
  const skills = listSkills(host);
  return tool({
    description:
      `Fetch office.js API documentation for a specific domain in ${host === 'word' ? 'Microsoft Word' : 'Microsoft Excel'}. ` +
      `Call this before writing code to get the correct API patterns, types, and examples. ` +
      `Available domains: ${skills.join(', ')}.`,
    inputSchema: jsonSchema<{ name: string }>({
      type: 'object',
      properties: {
        name: { type: 'string', enum: skills as unknown as string[] },
      },
      required: ['name'],
      additionalProperties: false,
    }),
    execute: async ({ name }) => lookupSkill(host, name),
  });
}
```

- [ ] **Step 2: Update `orchestrator.ts` — accept host, use factory**

In `src/taskpane/agent/orchestrator.ts`:

Change the import:
```ts
import { makeLookupSkillTool } from './tools.ts';
import type { HostKind } from '../host/context.ts';
```

Add `host` to the `runAgent` signature:
```ts
export async function runAgent(
  userMessage: string,
  conversationHistory: ModelMessage[],
  settings: AppSettings,
  sandbox: Sandbox,
  host: HostKind,
  callbacks: OrchestratorCallbacks,
): Promise<ModelMessage[]> {
```

In the `streamText({...})` call, swap `lookup_skill: lookupSkillTool` for `lookup_skill: makeLookupSkillTool(host)`.

(System prompt still hard-codes Word for now — fixed in Phase 3 Task 8.)

- [ ] **Step 3: Update `App.tsx` to pass `host.kind` into `runAgent`**

In `handleSend`'s call to `runAgent`, add `host.kind` as the 5th argument before `callbacks`:

```tsx
const history = await runAgent(
  text,
  conversationHistory.current,
  settings,
  sandboxRef.current!,
  host.kind,
  callbacks,
);
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Smoke test in Word**

Run: `npm run sideload`. Send "insert a 3-column table". Confirm the agent calls `lookup_skill('tables')` and code runs.

- [ ] **Step 6: Commit (combines Tasks 4 + 5 since Task 4 left the build broken)**

```bash
git add src/taskpane/skills/ src/taskpane/agent/tools.ts src/taskpane/agent/orchestrator.ts src/taskpane/App.tsx
git commit -m "Make skill registry and lookup_skill tool host-aware"
```

---

## Phase 3 — Sandbox & system prompt host-awareness

### Task 6: Make `sandbox.ts` host-aware

**Files:**
- Modify: `src/taskpane/executor/sandbox.ts`
- Modify: `src/taskpane/App.tsx`

- [ ] **Step 1: Replace `sandbox.ts`**

```ts
// src/taskpane/executor/sandbox.ts
import type { HostKind } from '../host/context.ts';

export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  stack?: string;
  logs?: string[];
}

const formatArg = (a: unknown): string => {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack || a.message;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
};

const makeCapturingConsole = (logs: string[]) => ({
  log:   (...args: unknown[]) => logs.push(args.map(formatArg).join(' ')),
  info:  (...args: unknown[]) => logs.push('[info] '  + args.map(formatArg).join(' ')),
  warn:  (...args: unknown[]) => logs.push('[warn] '  + args.map(formatArg).join(' ')),
  error: (...args: unknown[]) => logs.push('[error] ' + args.map(formatArg).join(' ')),
  debug: (...args: unknown[]) => logs.push('[debug] ' + args.map(formatArg).join(' ')),
});

export class Sandbox {
  constructor(private readonly host: HostKind) {}

  init(): void {}
  destroy(): void {}

  async execute(code: string, timeout: number = 30000): Promise<ExecutionResult> {
    const ns = this.host === 'word' ? 'Word' : 'Excel';
    const otherNs = this.host === 'word' ? 'Excel' : 'Word';
    const trimmed = code.trim();

    // Reject code targeting the wrong host before running it. Yields a clear
    // error the agent can self-heal on, instead of an opaque "X is not defined".
    if (trimmed.startsWith(`${otherNs}.run`)) {
      return {
        success: false,
        error: `Code uses ${otherNs}.run but the add-in is running in ${ns}. Rewrite using ${ns}.run.`,
        logs: [],
      };
    }

    const isWrapped = trimmed.startsWith(`${ns}.run`);
    const execCode = isWrapped
      ? `return (${trimmed.replace(/;+\s*$/, '')});`
      : `return ${ns}.run(async function(context) {\n${code}\n});`;

    const logs: string[] = [];
    const capturingConsole = makeCapturingConsole(logs);

    const timeoutPromise = new Promise<ExecutionResult>((resolve) =>
      setTimeout(
        () => resolve({ success: false, error: `Execution timed out after ${timeout}ms`, logs }),
        timeout
      )
    );

    const executionPromise = (async (): Promise<ExecutionResult> => {
      try {
        const fn = new Function('console', execCode);
        const result = await fn(capturingConsole);
        return { success: true, output: result, logs };
      } catch (err) {
        const e = err as Error;
        return { success: false, error: e.message || String(err), stack: e.stack, logs };
      }
    })();

    return Promise.race([executionPromise, timeoutPromise]);
  }
}
```

- [ ] **Step 2: Update `App.tsx` to pass host into Sandbox constructor**

In `App.tsx`, replace the `useEffect` that creates the sandbox:

```tsx
useEffect(() => {
  const sandbox = new Sandbox(host.kind);
  sandbox.init();
  sandboxRef.current = sandbox;
  return () => sandbox.destroy();
}, [host.kind]);
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Smoke test in Word**

Run: `npm run sideload`. Send "make the first paragraph bold". Confirm code runs end-to-end.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/executor/sandbox.ts src/taskpane/App.tsx
git commit -m "Make Sandbox host-aware (Word.run vs Excel.run)"
```

---

### Task 7: Mirror host-aware wrapping in `iframe.html`

**Files:**
- Modify: `src/taskpane/executor/iframe.html`

This file is referenced in the README's architecture diagram but is **not currently wired into the execution path** — `Sandbox.execute` runs code via `new Function` in the parent window. We update it for symmetry so a future move to iframe-based execution doesn't carry the Word-only assumption.

- [ ] **Step 1: Replace the script body in `iframe.html`**

```html
<script>
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'execute' || !data.id) return;

    var id = data.id;
    var code = data.code;
    var host = data.host === 'excel' ? 'excel' : 'word'; // default word for back-compat
    var ns = host === 'excel' ? 'Excel' : 'Word';
    var otherNs = host === 'excel' ? 'Word' : 'Excel';

    var trimmed = code.trim();
    if (trimmed.indexOf(otherNs + '.run') === 0) {
      parent.postMessage({
        type: 'error', id: id, success: false,
        error: 'Code uses ' + otherNs + '.run but host is ' + ns + '. Rewrite using ' + ns + '.run.',
        logs: []
      }, '*');
      return;
    }

    var isWrapped = trimmed.indexOf(ns + '.run') === 0;
    var execCode = isWrapped
      ? 'return (' + trimmed.replace(/;+\s*$/, '') + ');'
      : 'return ' + ns + '.run(async function(context) {\n' + code + '\n});';

    var logs = [];
    function formatArg(a) {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack || a.message;
      try { return JSON.stringify(a); } catch (e) { return String(a); }
    }
    function pushLog(prefix, args) {
      var parts = [];
      for (var i = 0; i < args.length; i++) parts.push(formatArg(args[i]));
      logs.push((prefix ? '[' + prefix + '] ' : '') + parts.join(' '));
    }
    var capturingConsole = {
      log:   function () { pushLog('', arguments); },
      info:  function () { pushLog('info', arguments); },
      warn:  function () { pushLog('warn', arguments); },
      error: function () { pushLog('error', arguments); },
      debug: function () { pushLog('debug', arguments); }
    };

    try {
      var fn = new Function('console', execCode);
      var result = fn(capturingConsole);

      if (result && typeof result.then === 'function') {
        result.then(function (output) {
          parent.postMessage({ type: 'result', id: id, success: true, output: output, logs: logs }, '*');
        }).catch(function (err) {
          parent.postMessage({ type: 'error', id: id, success: false, error: err.message || String(err), stack: err.stack || '', logs: logs }, '*');
        });
      } else {
        parent.postMessage({ type: 'result', id: id, success: true, output: result, logs: logs }, '*');
      }
    } catch (err) {
      parent.postMessage({ type: 'error', id: id, success: false, error: err.message || String(err), stack: err.stack || '', logs: logs }, '*');
    }
  });

  parent.postMessage({ type: 'sandbox-ready' }, '*');
</script>
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success (this is just a static asset, no TS impact).

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/executor/iframe.html
git commit -m "Mirror host-aware code wrapping in legacy iframe.html"
```

---

### Task 8: Build the system prompt dynamically

**Files:**
- Create: `src/taskpane/agent/system-prompt.ts`
- Modify: `src/taskpane/agent/orchestrator.ts`

- [ ] **Step 1: Create `system-prompt.ts`**

```ts
// src/taskpane/agent/system-prompt.ts
import type { HostKind } from '../host/context.ts';

export function buildSystemPrompt(host: HostKind, skills: readonly string[]): string {
  const hostName = host === 'word' ? 'Microsoft Word' : 'Microsoft Excel';
  const apiRoot = host === 'word' ? 'Word' : 'Excel';
  const insertEnumNote = host === 'word'
    ? '- You MUST use Word.InsertLocation enum for insertion positions'
    : '- For inserting/clearing ranges, prefer typed Excel APIs (e.g. range.values = [[...]], range.clear()) over string concatenation';

  return `You are AutoOffice, an AI assistant that controls ${hostName} by writing and executing office.js code.

You have tools to look up API documentation and execute code.

Available skill topics for lookup_skill: ${skills.join(', ')}.

CRITICAL RULES for office.js code:
- You MUST load() properties before reading them
- You MUST await context.sync() after load() and before accessing values
${insertEnumNote}
- NEVER use DOM manipulation — only the office.js API
- Code runs in a sandbox with access to the ${apiRoot} object model

When the user asks you to do something with the document:
1. ALWAYS call lookup_skill before writing code — it provides the correct API patterns, types, and examples for the relevant topic
2. To read state, write execute_code that loads and returns the needed properties
3. Generate the code and call execute_code
4. If execution fails, analyze the error and try again (up to 3 attempts)

Your code can be either a full ${apiRoot}.run() block or just the inner body — the executor handles both.`;
}
```

- [ ] **Step 2: Update `orchestrator.ts` to use it**

In `orchestrator.ts`, delete the top-level `SYSTEM_PROMPT` constant and add:

```ts
import { buildSystemPrompt } from './system-prompt.ts';
import { listSkills } from '../skills/index.ts';
```

In `runAgent`, replace `system: SYSTEM_PROMPT,` with:

```ts
system: buildSystemPrompt(host, listSkills(host)),
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Smoke test in Word**

Run: `npm run sideload`. Send "make the first paragraph bold". Confirm normal behavior.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/agent/system-prompt.ts src/taskpane/agent/orchestrator.ts
git commit -m "Build agent system prompt dynamically per host"
```

---

## Phase 4 — UI host badge

### Task 9: Add host badge to `ChatPanel` header

**Files:**
- Modify: `src/taskpane/components/ChatPanel.tsx`
- Modify: `src/taskpane/App.tsx`

- [ ] **Step 1: Pass `host` from `App` into `ChatPanel`**

In `App.tsx`, add `host={host}` to the `<ChatPanel ... />` JSX.

- [ ] **Step 2: Update `ChatPanel.tsx` to accept and render the badge**

Add to the imports at the top:

```tsx
import { Badge } from '@fluentui/react-components';
import type { HostContext } from '../host/context.ts';
```

Add to the `ChatPanelProps` interface:

```tsx
host: HostContext;
```

Update the destructuring in the component signature to include `host`.

In the JSX, change the brand block to add the badge right after the title:

```tsx
<div className={styles.brand}>
  <img
    src={`${import.meta.env.BASE_URL}assets/icon-64.png`}
    alt=""
    className={styles.logo}
  />
  <Text className={styles.title}>AutoOffice</Text>
  <Badge appearance="outline" size="small">{host.displayName}</Badge>
</div>
```

Also update the welcome message text to be host-agnostic. Replace:

```tsx
<Text size={200}>
  Ask me to do anything with your Word document. I'll write and run office.js code to make it happen.
</Text>
<Text size={200}>
  Try: "Make all headings blue" or "Insert a 3-column table"
</Text>
```

with:

```tsx
<Text size={200}>
  Ask me to do anything with your {host.displayName} document. I'll write and run office.js code to make it happen.
</Text>
<Text size={200}>
  {host.kind === 'word'
    ? 'Try: "Make all headings blue" or "Insert a 3-column table"'
    : 'Try: "Put 1 through 10 in column A" or "Make a chart from B2:D8"'}
</Text>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Smoke test in Word**

Run: `npm run sideload`. Confirm "Word" badge appears next to the AutoOffice title and the welcome text says "Word document".

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/components/ChatPanel.tsx src/taskpane/App.tsx
git commit -m "Add host badge and host-aware welcome text to ChatPanel header"
```

---

## Phase 5 — Manifest & Excel sideload tooling

### Task 10: Add Workbook host to `manifest.xml`

**Files:**
- Modify: `manifest.xml`

- [ ] **Step 1: Add `Workbook` to top-level `<Hosts>`**

In `manifest.xml`, replace the `<Hosts>` block (lines 19–21) with:

```xml
<Hosts>
  <Host Name="Document" />
  <Host Name="Workbook" />
</Hosts>
```

- [ ] **Step 2: Add a Workbook block inside `VersionOverrides`**

After the closing `</Host>` of the existing `<Host xsi:type="Document">` block (line 67), and before `</Hosts>` (line 68), add:

```xml
<Host xsi:type="Workbook">
  <DesktopFormFactor>
    <GetStarted>
      <Title resid="GetStarted.Title" />
      <Description resid="GetStarted.Description" />
      <LearnMoreUrl resid="GetStarted.LearnMoreUrl" />
    </GetStarted>
    <ExtensionPoint xsi:type="PrimaryCommandSurface">
      <OfficeTab id="TabHome">
        <Group id="AutoOfficeGroupExcel">
          <Label resid="CommandsGroup.Label" />
          <Icon>
            <bt:Image size="16" resid="Icon.16x16" />
            <bt:Image size="32" resid="Icon.32x32" />
            <bt:Image size="80" resid="Icon.80x80" />
          </Icon>
          <Control xsi:type="Button" id="TaskpaneButtonExcel">
            <Label resid="TaskpaneButton.Label" />
            <Supertip>
              <Title resid="TaskpaneButton.Label" />
              <Description resid="TaskpaneButton.Tooltip" />
            </Supertip>
            <Icon>
              <bt:Image size="16" resid="Icon.16x16" />
              <bt:Image size="32" resid="Icon.32x32" />
              <bt:Image size="80" resid="Icon.80x80" />
            </Icon>
            <Action xsi:type="ShowTaskpane">
              <TaskpaneId>AutoOfficeTaskPane</TaskpaneId>
              <SourceLocation resid="Taskpane.Url" />
            </Action>
          </Control>
        </Group>
      </OfficeTab>
    </ExtensionPoint>
  </DesktopFormFactor>
</Host>
```

(Group and control IDs differ from the Word block — `AutoOfficeGroupExcel` / `TaskpaneButtonExcel` — because IDs must be unique across hosts in some Office validators.)

- [ ] **Step 3: Update the description string**

In the same file, change:
```xml
<Description DefaultValue="AI-powered dynamic code execution add-in for Microsoft Word" />
```
to:
```xml
<Description DefaultValue="AI-powered dynamic code execution add-in for Microsoft Word and Excel" />
```

And the long string for `GetStarted.Description`:
```xml
<bt:String id="GetStarted.Description" DefaultValue="AI-powered assistant for Word and Excel" />
```

- [ ] **Step 4: Validate the manifest**

Run: `npx office-addin-manifest validate manifest.xml`
Expected: PASS. If it fails on multi-host structure on the target Office version, see Risks in the spec — fall back to two-manifest distribution. Do **not** preemptively split.

- [ ] **Step 5: Commit**

```bash
git add manifest.xml
git commit -m "Add Excel (Workbook) host to manifest.xml"
```

---

### Task 11: Same changes to `manifest.production.xml`

**Files:**
- Modify: `manifest.production.xml`

- [ ] **Step 1: Apply the identical changes from Task 10 to `manifest.production.xml`**

The structure of `manifest.production.xml` mirrors `manifest.xml` with production URLs. Make the same three edits:
1. Add `<Host Name="Workbook" />` to `<Hosts>`.
2. Add the `<Host xsi:type="Workbook">` block to `VersionOverrides` (same JSX as Task 10 Step 2).
3. Update the two description strings to mention "Word and Excel".

- [ ] **Step 2: Validate**

Run: `npx office-addin-manifest validate manifest.production.xml`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add manifest.production.xml
git commit -m "Add Excel (Workbook) host to manifest.production.xml"
```

---

### Task 12: Add Excel sideload npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `start:excel` and `sideload:excel` scripts**

In `package.json`, change the `"scripts"` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "certs": "office-addin-dev-certs install",
  "start": "office-addin-debugging start manifest.xml --app word",
  "start:excel": "office-addin-debugging start manifest.xml --app excel",
  "stop": "office-addin-debugging stop manifest.xml",
  "sideload": "office-addin-debugging start manifest.xml desktop --no-debug --app word",
  "sideload:excel": "office-addin-debugging start manifest.xml desktop --no-debug --app excel"
}
```

(Note: the existing `sideload` script does not currently pass `--app word`. Adding it explicitly disambiguates now that the manifest declares both hosts.)

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "Add Excel sideload npm scripts"
```

---

## Phase 6 — Author Excel skill markdown (21 files)

Each Excel skill is its own bite-sized task: write one markdown file, register it in `excel/index.ts`, build, commit. The files all share the same shape — modeled on the existing Word skills:

```markdown
# <Title>

## Key Types
- `Excel.<Type>` — short description, key methods/properties

## <Pattern 1 name>

```javascript
await Excel.run(async (context) => {
  // working example with load/sync
});
```

## <Pattern 2 name>

```javascript
await Excel.run(async (context) => {
  // ...
});
```

## Common Mistakes
- One sentence per common error and how to avoid it.
```

Each task below specifies the file path and the topics that **must** be covered. Use the office.js Excel API reference (https://learn.microsoft.com/en-us/javascript/api/excel) for ground truth on type names and method signatures. After each file, register it in `src/taskpane/skills/excel/index.ts` (Step pattern shown in Task 13 — repeat structure for every subsequent skill).

> **Reusable verification step for every skill task:**
> - Build: `npm run build` → success
> - Commit:
>   ```bash
>   git add src/taskpane/skills/excel/<file>.md src/taskpane/skills/excel/index.ts
>   git commit -m "Add Excel skill: <skill-name>"
>   ```

---

### Task 13: Excel skill — `context-sync`

**Files:**
- Create: `src/taskpane/skills/excel/context-sync.md`
- Modify: `src/taskpane/skills/excel/index.ts`

- [ ] **Step 1: Author `context-sync.md`** — must cover:
  - `Excel.run(async (context) => { … })` entry point and what `context.workbook` exposes
  - Why `load()` is required before reading a property
  - Why `await context.sync()` is required after `load()` and before reading values
  - The proxy object model (you can chain operations without sync, sync flushes the queue)
  - `context.workbook.application.suspendApiCalculationUntilNextSync()` for batched perf-sensitive writes
  - `context.trackedObjects.add()` / `.remove()` — when long-lived references span multiple syncs
  - 1 working example showing read+write+sync
  - Common mistakes: reading a value before sync; not calling load; calling sync too often in a loop

- [ ] **Step 2: Register in `excel/index.ts`** (this is the registration pattern used in every subsequent skill task — copy this exact form):

```ts
// src/taskpane/skills/excel/index.ts
import contextSync from './context-sync.md?raw';

export const EXCEL_SKILL_NAMES = [
  'context-sync',
] as const;
export type ExcelSkillName = (typeof EXCEL_SKILL_NAMES)[number];

export const EXCEL_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
};
```

For each subsequent skill, add the import line, append the skill name to `EXCEL_SKILL_NAMES`, and add the entry to `EXCEL_SKILLS`.

- [ ] **Step 3: Build + Commit** (per the reusable pattern above)

---

### Task 14: Excel skill — `workbook`

- [ ] **Step 1: Author `src/taskpane/skills/excel/workbook.md`** — must cover:
  - `context.workbook` properties: `name`, `worksheets`, `tables`, `names`, `application`
  - `Excel.CalculationMode` enum (Automatic, Manual, AutomaticExceptTables) and how to set
  - `context.workbook.application.calculate(Excel.CalculationType.full)`
  - Reading workbook-level properties (saving, requires sync)
  - 1 example: switch calc mode → bulk update → switch back
  - Common mistakes: leaving calc mode in Manual; assuming workbook.save behavior

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 15: Excel skill — `worksheets`

- [ ] **Step 1: Author `src/taskpane/skills/excel/worksheets.md`** — must cover:
  - `context.workbook.worksheets`: `getActiveWorksheet()`, `getItem(name)`, `getItemAt(index)`, `add(name?)`, `getCount()`
  - Sheet operations: `delete()`, `activate()`, `name`, `position`, `visibility` (Excel.SheetVisibility)
  - Iterating sheets (load `items/name`, then iterate)
  - Copying a sheet via `copy(positionType?, relativeTo?)`
  - 1 example: add a sheet, write a header, activate it
  - Common mistakes: deleting the only visible sheet; relying on index after add

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 16: Excel skill — `ranges` (the most-used skill — invest extra detail)

- [ ] **Step 1: Author `src/taskpane/skills/excel/ranges.md`** — must cover:
  - Getting ranges: `worksheet.getRange("A1:C3")`, `worksheet.getRange("A1")`, `worksheet.getCell(row, col)`, `worksheet.getRangeByIndexes(rowIndex, colIndex, rowCount, colCount)`
  - `getUsedRange(valuesOnly?)`, `getEntireRow()`, `getEntireColumn()`, `getResizedRange(rows, cols)`, `getOffsetRange(rows, cols)`, `getBoundingRect(other)`
  - Reading: load `values`, `formulas`, `numberFormat`, `text`, `rowCount`, `columnCount`, `address`
  - Writing: `range.values = [[...], [...]]` (2D array, must match shape), `range.formulas`, `range.clear(Excel.ClearApplyTo.contents)`
  - Inserting/deleting: `range.insert(Excel.InsertShiftDirection.down)`, `range.delete(Excel.DeleteShiftDirection.up)`
  - 2 examples: bulk write, read a region into a 2D array
  - Common mistakes: writing a 1D array; off-by-one in `getRangeByIndexes`; reading values before sync; assuming `clear()` clears formats too

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 17: Excel skill — `formulas`

- [ ] **Step 1: Author `src/taskpane/skills/excel/formulas.md`** — must cover:
  - Setting a formula via `range.formulas = [["=SUM(A1:A10)"]]`
  - A1 vs R1C1 (`formulasR1C1`) and locale-aware (`formulasLocal`)
  - Dynamic array formulas (single cell spills) — when to use `formulas` vs single-cell write
  - Triggering recalc: `context.workbook.application.calculate(Excel.CalculationType.fullRebuild)`
  - 1 example: write a column of formulas referencing the row above
  - Common mistakes: shape mismatch on `formulas`; using `formulasLocal` in non-en-US workbooks; expecting formulas to evaluate before sync

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 18: Excel skill — `number-formats`

- [ ] **Step 1: Author `src/taskpane/skills/excel/number-formats.md`** — must cover:
  - `range.numberFormat = [["0.00"]]` (2D array, same shape as range)
  - Common format codes: integers, decimals, percentages, currencies, dates (`yyyy-mm-dd`, `m/d/yyyy h:mm`), text (`@`)
  - `numberFormatLocal` vs `numberFormat`
  - 1 example: format a column as currency
  - Common mistakes: using locale-specific separators in `numberFormat`; not matching the 2D shape; forgetting that text-format prevents date parsing

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 19: Excel skill — `formatting`

- [ ] **Step 1: Author `src/taskpane/skills/excel/formatting.md`** — must cover:
  - `range.format`: `font` (bold/italic/color/size/name/underline), `fill` (color), `borders` (`getItem(Excel.BorderIndex.edgeBottom)` — style/color/weight), `horizontalAlignment` / `verticalAlignment`, `wrapText`, `indentLevel`
  - Row height / column width: `range.format.rowHeight`, `range.format.columnWidth`, `range.format.autofitRows()`, `autofitColumns()`
  - Setting all borders: iterate all `BorderIndex` values
  - 1 example: bold first row + light-gray fill + bottom border
  - Common mistakes: setting `fill.color` to undefined to clear (use `fill.clear()` instead); confusing border index with edge

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 20: Excel skill — `styles`

- [ ] **Step 1: Author `src/taskpane/skills/excel/styles.md`** — must cover:
  - `context.workbook.styles` — `getItem(name)`, `add(name)`
  - Built-in style names ("Good", "Bad", "Heading 1", "Title", "Currency")
  - Apply: `range.style = "Good"` or `range.styleSet(...)`
  - Custom styles: create, set font/fill/etc., then assign to a range
  - 1 example: apply built-in "Heading 1" to row 1
  - Common mistakes: assuming style overrides direct formatting (it doesn't always); style names are localized

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 21: Excel skill — `tables`

- [ ] **Step 1: Author `src/taskpane/skills/excel/tables.md`** — must cover:
  - Create: `worksheet.tables.add("A1:C5", true /* hasHeaders */)`
  - Set name and style: `table.name = "Sales"`, `table.style = "TableStyleMedium2"`
  - Columns: `table.columns.getItem("Name")`, `getDataBodyRange()`, `getHeaderRowRange()`, `getTotalRowRange()`
  - Adding rows: `table.rows.add(null, [["a","b","c"]])`
  - Totals row: `table.showTotals = true`, set per-column totalRowFunction
  - Structured references in formulas: `=Sales[Amount]`
  - 1 example: convert a range to a table and add a totals row
  - Common mistakes: range argument must be string address; "hasHeaders" matters; can't have two tables overlap

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 22: Excel skill — `named-items`

- [ ] **Step 1: Author `src/taskpane/skills/excel/named-items.md`** — must cover:
  - Workbook scope vs worksheet scope: `context.workbook.names` vs `worksheet.names`
  - Add a named range: `names.add("TaxRate", "=Sheet1!$B$1")` or `add("TaxRate", range)`
  - Add a named formula: `names.add("Discount", "=0.1")`
  - Reading: `getItem(name)`, `formula`, `value`, `type`, `visible`
  - Delete: `name.delete()`
  - 1 example: define `=TaxRate` and reference it in a cell formula
  - Common mistakes: name collisions across scopes; absolute vs relative refs; reserved names

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 23: Excel skill — `charts`

- [ ] **Step 1: Author `src/taskpane/skills/excel/charts.md`** — must cover:
  - Create: `worksheet.charts.add(Excel.ChartType.columnClustered, sourceRange, Excel.ChartSeriesBy.auto)`
  - Common types: `columnClustered`, `line`, `pie`, `bar`, `scatter`, `area`
  - Title: `chart.title.text = "Sales"`, `chart.title.visible = true`
  - Axes: `chart.axes.valueAxis.title.text`, `chart.axes.categoryAxis.title.text`
  - Legend: `chart.legend.visible`, `chart.legend.position` (Excel.ChartLegendPosition)
  - Position/size: `chart.setPosition("A10", "F25")` or `chart.left/top/width/height`
  - Series: `chart.series.getItemAt(0).name`, `format.fill.setSolidColor("#0078D4")`
  - 1 example: build a column chart from B2:D8
  - Common mistakes: source range string vs Range object; can't set title before sync if it didn't exist before

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 24: Excel skill — `pivot-tables`

- [ ] **Step 1: Author `src/taskpane/skills/excel/pivot-tables.md`** — must cover:
  - Create: `worksheet.pivotTables.add("Pivot1", sourceRange, destinationRange)`
  - Field hierarchies: `rowHierarchies`, `columnHierarchies`, `dataHierarchies`, `filterHierarchies` — `add(pivotTable.hierarchies.getItem("Region"))`
  - Aggregation: data hierarchy's `summarizeBy` (Excel.AggregationFunction)
  - Refresh: `pivotTable.refresh()`
  - Layout: `pivotTable.layout.layoutType` (Excel.PivotLayoutType)
  - 1 example: pivot a sales table by Region (rows) × Product (columns), summing Amount
  - Common mistakes: sourceRange must include headers; refresh required after data changes; hierarchy name must match source header

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 25: Excel skill — `conditional-formatting`

- [ ] **Step 1: Author `src/taskpane/skills/excel/conditional-formatting.md`** — must cover:
  - Add: `range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue)` — returns `ConditionalFormat`
  - Types: `cellValue`, `colorScale`, `dataBar`, `iconSet`, `textComparison`, `topBottom`, `presetCriteria`, `containsText`, `custom`
  - Cell-value rule: `cf.cellValue.rule = { formula1: "0", operator: Excel.ConditionalCellValueOperator.lessThan }; cf.cellValue.format.font.color = "red"`
  - Color scale: `cf.colorScale.criteria = { minimum, midpoint?, maximum }` with `type` (lowestValue / number / percent / formula / percentile / highestValue) and `color`
  - Priority: `cf.priority` (lower = higher precedence), `stopIfTrue`
  - Clear: `range.conditionalFormats.clearAll()`
  - 1 example: red fill where value < 0
  - Common mistakes: format properties must be set inside the type-specific group (`cf.cellValue.format`), not at top level; priority conflicts

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 26: Excel skill — `data-validation`

- [ ] **Step 1: Author `src/taskpane/skills/excel/data-validation.md`** — must cover:
  - `range.dataValidation` — `rule`, `errorAlert`, `prompt`, `ignoreBlanks`, `clear()`
  - Rule types: `wholeNumber`, `decimal`, `list`, `date`, `time`, `textLength`, `custom`
  - List dropdown: `rule = { list: { source: "Yes,No,Maybe", inCellDropDown: true } }`
  - Whole number range: `rule = { wholeNumber: { formula1: "1", formula2: "100", operator: Excel.DataValidationOperator.between } }`
  - Error alert: `errorAlert = { showAlert: true, style: Excel.DataValidationAlertStyle.stop, title: "...", message: "..." }`
  - 1 example: dropdown of Yes/No on a column
  - Common mistakes: list source must be a comma-separated string OR a range address `"=Sheet1!$A$1:$A$3"`; `inCellDropDown` defaults inconsistently

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 27: Excel skill — `filters-sort`

- [ ] **Step 1: Author `src/taskpane/skills/excel/filters-sort.md`** — must cover:
  - Worksheet AutoFilter: `worksheet.autoFilter.apply(range, columnIndex?, criteria?)`, `clearCriteria()`, `remove()`
  - Table column filter: `table.columns.getItemAt(0).filter.apply{Values,Custom,DynamicFilter,...}`
  - Filter criteria objects: `Excel.FilterCriteria` with `filterOn`, `criterion1`, `criterion2`, `operator`, `values`
  - Sorting a range: `range.sort.apply([{ key: 0, ascending: true }], false /* matchCase */)`
  - Sorting a table: `table.sort.apply([{ key: 0, ascending: false }])`
  - Custom sort orders, sort by color
  - 1 example: filter table to "Region == West"; sort by Amount desc
  - Common mistakes: `key` is column index within the sort range, not absolute column; AutoFilter and table filter are separate APIs

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 28: Excel skill — `comments`

- [ ] **Step 1: Author `src/taskpane/skills/excel/comments.md`** — must cover:
  - Modern threaded comments: `worksheet.comments.add(cellAddress, content, contentType?)`, `add` returns `Comment`
  - Replies: `comment.replies.add(content, contentType?)`
  - Resolved state: `comment.resolved = true`
  - Mentions: `Excel.ContentType.mention` with `CommentMentions`
  - Read: `getItemAt(index)`, load `content`, `authorName`, `authorEmail`, `creationDate`
  - Delete: `comment.delete()`
  - 1 example: add a comment to A1 and a reply
  - Common mistakes: confusing legacy notes with modern comments; comments are workbook-level, indexed inside `worksheet.comments`

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 29: Excel skill — `hyperlinks`

- [ ] **Step 1: Author `src/taskpane/skills/excel/hyperlinks.md`** — must cover:
  - `range.hyperlink = { address, textToDisplay?, screenTip?, documentReference?, emailAddress? }`
  - Types: external URL (use `address`), workbook location (use `documentReference: "Sheet2!A1"`), email (use `emailAddress`)
  - Reading existing hyperlinks: `range.hyperlink` returns the current value object
  - Clearing: `range.clear()` clears values; `range.hyperlink = null` may not work — use `range.clear(Excel.ClearApplyTo.hyperlinks)`
  - 1 example: link "Click here" in A1 to https://example.com
  - Common mistakes: setting only `address` without `textToDisplay` shows the URL; `documentReference` requires `Sheet!Cell` form

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 30: Excel skill — `images-shapes`

- [ ] **Step 1: Author `src/taskpane/skills/excel/images-shapes.md`** — must cover:
  - Insert image: `worksheet.shapes.addImage(base64String)` — base64 of PNG/JPG
  - Insert geometric shape: `worksheet.shapes.addGeometricShape(Excel.GeometricShapeType.rectangle)`
  - Properties: `shape.left`, `top`, `width`, `height`, `name`, `altText{Title,Description}`
  - Z-order: `shape.zorder` enum (BringForward, SendBackward, etc.) via `incrementRotation` / `setZOrder`
  - Move/resize: directly set left/top/width/height (in points)
  - Delete: `shape.delete()`
  - Reading shapes: `worksheet.shapes.getItem(name)` or `getItemAt(index)`, load `name`, `type`
  - 1 example: add a base64 image at (10, 10) sized 200x100
  - Common mistakes: base64 must not include the `data:image/png;base64,` prefix; coordinates are points, not pixels

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 31: Excel skill — `protection`

- [ ] **Step 1: Author `src/taskpane/skills/excel/protection.md`** — must cover:
  - Workbook protection: `context.workbook.protection.protect({ password? })`, `unprotect(password?)`, `protected` property
  - Worksheet protection: `worksheet.protection.protect(options?, password?)` where options is `WorksheetProtectionOptions` (allowInsertRows, allowFormatCells, allowSort, …)
  - Range-level allow-edit ranges (Office model differences)
  - Read protection state: load `protected`
  - 1 example: protect a sheet but allow sort + autofilter
  - Common mistakes: passwords are weak (Excel obfuscation); options not specified means "everything blocked"; some options are version-dependent

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 32: Excel skill — `events`

- [ ] **Step 1: Author `src/taskpane/skills/excel/events.md`** — must cover:
  - Worksheet events: `worksheet.onChanged.add(handler)`, `onSelectionChanged`, `onActivated`, `onDeactivated`, `onCalculated`, `onRowSorted`, `onColumnSorted`, `onFormatChanged`
  - Workbook events: `workbook.worksheets.onAdded`, `onDeleted`, `onActivated`
  - Handler shape: `async (event) => { … }` with event.address, event.changeType, event.source
  - Removing a handler: `await event.remove()` returned by `add`
  - Why event handlers count toward background work — keep them lightweight
  - 1 example: log every cell change in a sheet
  - Common mistakes: forgetting to `await context.sync()` inside the handler; not removing handlers on teardown; handlers fire after the change, not before

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

### Task 33: Excel skill — `ooxml`

- [ ] **Step 1: Author `src/taskpane/skills/excel/ooxml.md`** — must cover:
  - `context.workbook.insertWorksheetsFromBase64(base64File, options?)` — insert sheets from a base64-encoded XLSX
  - Options: `positionType` (Excel.WorksheetPositionType), `relativeTo`, `sheetNamesToInsert`
  - Result: returns inserted worksheet collection (load `items/name`)
  - When to use: copying templates, importing layouts that are hard to construct via API
  - Building base64: caller must produce a full XLSX package (zip with workbook.xml, sheet xml, etc.); usually a server pre-built file
  - 1 example: insert all sheets from a base64 file at the end
  - Common mistakes: base64 must not include data-URL prefix; insertion of duplicate sheet names auto-renames; large files block the sync

- [ ] **Step 2: Register; Step 3: Build + Commit**

---

## Phase 7 — Polish, docs, smoke tests

### Task 34: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update title and description**

Replace line 7:
```markdown
<p align="center">AI-powered Microsoft Word add-in that writes and executes real <code>office.js</code> code on demand.</p>
```
with:
```markdown
<p align="center">AI-powered Microsoft Word + Excel add-in that writes and executes real <code>office.js</code> code on demand.</p>
```

- [ ] **Step 2: Update "What It Does" examples**

In the example list around line 11, add an Excel example: change `("make all headings blue", "insert a 3-column table", "replace every instance of 'foo' with 'bar'")` to include something like `("make all headings blue in Word", "put 1–10 in column A in Excel", "build a column chart from B2:D8")`.

- [ ] **Step 3: Update prerequisites**

Replace `- Microsoft 365 (Word on Web or Desktop)` with `- Microsoft 365 (Word or Excel — Web or Desktop)`.

- [ ] **Step 4: Update sideload command section**

After the existing "Run + sideload" section, add:

```markdown
For Excel:

```bash
npm run start:excel       # debugger
npm run sideload:excel    # no debugger
```
```

- [ ] **Step 5: Add "Settings are shared between hosts" note**

In the Settings section, add one sentence: "Provider, API key, MCP server, and other settings are shared between Word and Excel by design — there is one logical add-in per install."

- [ ] **Step 6: Update Architecture section**

In the architecture diagram caption (under `## Architecture`), add a sentence after the diagram: "The same task pane runs in Word and Excel; `HostContext` is resolved at startup and gates the skill registry, sandbox wrapping, and system prompt per host."

- [ ] **Step 7: Update the Comparison table**

In the comparison table, change the "Multi-doc context" row for AutoOffice from `❌` to `❌ (Word + Excel, single-doc)`. Optionally add a note that AutoOffice now covers both Word and Excel.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "Document Excel support in README"
```

---

### Task 35: Update installer copy

**Files:**
- Modify: `installer/setup.iss`
- Modify: `installer/autooffice.nsi` (if it has display strings)

- [ ] **Step 1: Update `setup.iss` MyAppName define**

In `installer/setup.iss`, change line 5:
```
#define MyAppName "AutoOffice Add-in"
```
to:
```
#define MyAppName "AutoOffice for Word & Excel"
```

- [ ] **Step 2: Update the post-install instruction message**

In the `[Messages]` section at the bottom, replace `FinishedLabel=...` with copy that mentions both Word and Excel:

```
FinishedLabel=ההתקנה הסתיימה בהצלחה.%n%nכדי להשתמש בתוסף ב-Word או Excel:%n%n1. פתח את Microsoft Word או Excel%n2. עבור לעמוד הבית > תוספות%n3. לחץ על "תיקייה משותפת" בחלק התחתון%n4. בחר "AutoOffice" והקלק הוסף
```

- [ ] **Step 3: Inspect `autooffice.nsi` for any "Word"-specific display strings**

Read `installer/autooffice.nsi`. If any user-facing string mentions "Word" specifically, update it to "Word & Excel". If the file has no such strings, skip.

- [ ] **Step 4: Commit**

```bash
git add installer/
git commit -m "Update installer copy to mention Word & Excel"
```

---

### Task 36: Word regression smoke test

**Verification only — no file changes.**

- [ ] **Step 1: Build a release-ish bundle**

Run: `npm run build`
Expected: success.

- [ ] **Step 2: Sideload into Word**

Run: `npm run sideload`
Open Word.

- [ ] **Step 3: Verify badge**

Open AutoOffice. Confirm a "Word" badge appears next to the title.

- [ ] **Step 4: Verify skill list & execution**

Send: "make the first paragraph bold". Expected: agent calls `lookup_skill('formatting')` (or similar), generates Word.run code, requests approval, executes successfully, paragraph becomes bold.

- [ ] **Step 5: Verify a table operation (regression on a non-trivial skill)**

Send: "insert a 3-column table with headers Name, Age, City". Expected: agent calls `lookup_skill('tables')`, generates code that calls `body.insertTable(...)`, executes successfully.

- [ ] **Step 6: If anything regresses, fix and re-run** before declaring this task complete.

---

### Task 37: Excel smoke test

**Verification only — no file changes (unless smoke surfaces a bug, then fix).**

- [ ] **Step 1: Sideload into Excel**

Run: `npm run sideload:excel`
Open Excel.

- [ ] **Step 2: Verify badge**

Open AutoOffice. Confirm an "Excel" badge appears next to the title (instead of "Word").

- [ ] **Step 3: Verify trivial Excel.run round trip**

Send: "put the numbers 1 through 10 in column A starting at A1". Expected: agent calls `lookup_skill('ranges')`, generates code that uses `Excel.run` and `range.values = [[1],[2],…]`, requests approval, runs, cells A1:A10 contain 1–10.

- [ ] **Step 4: Verify a second Excel skill in use**

Send: "make A1:A10 bold and yellow". Expected: agent calls `lookup_skill('formatting')`, sets `range.format.font.bold = true` and `range.format.fill.color`, runs successfully.

- [ ] **Step 5: Verify wrong-namespace guard**

(Optional, if you can prompt the agent to mistakenly use Word.run.) Send: "use Word.run to put 5 in A1". Expected: sandbox returns the structured "Code uses Word.run but the add-in is running in Excel" error; agent self-heals and rewrites with Excel.run on retry.

- [ ] **Step 6: If anything fails, fix the underlying issue, re-build, and re-run this task.** Do not check the box until both Word (Task 36) and Excel (Task 37) smoke tests pass cleanly.

---

### Task 38: Final summary commit

- [ ] **Step 1: Confirm `git status` is clean**

Run: `git status`
Expected: working tree clean (everything committed in prior tasks).

- [ ] **Step 2: Tag or push (per project release convention)**

If the project tags releases, this is where a `v1.1.0` (or similar) tag would land. Defer to the user — do not push or tag without explicit instruction.

---

## Self-review notes (filled in by the plan author)

**Spec coverage:**
- Spec §1 Host context → Tasks 1, 2
- Spec §2 Manifest → Tasks 10, 11
- Spec §3 Sandbox → Tasks 6, 7
- Spec §4 Skill registry restructure → Tasks 3, 4, 5
- Spec §4 Excel skill list (21) → Tasks 13–33 (21 tasks, one per skill)
- Spec §5 Orchestrator + system prompt → Tasks 5, 8
- Spec §6 Host badge → Task 9
- Spec §7 Settings/build/installer → Tasks 12, 35 (settings: zero-change as designed; build: zero-change as designed)
- Spec §7 README → Task 34
- Spec §8 Risks: manifest validation → Task 10 Step 4; Excel.run availability → Task 37; skill shallowness → 21 individual tasks; per-host settings expectation → Task 34 Step 5
- Spec §9 Implementation breakdown → mirrored in phase ordering

**Placeholder check:** No "TBD" / "implement later" / "add appropriate error handling" markers in steps. All code blocks are complete, runnable.

**Type consistency:** `HostKind`, `HostContext`, `detectHost`, `UnsupportedHostError`, `Sandbox(host)`, `runAgent(..., host, callbacks)`, `makeLookupSkillTool(host)`, `buildSystemPrompt(host, skills)`, `listSkills(host)`, `lookupSkill(host, name)`, `WORD_SKILLS`/`WORD_SKILL_NAMES`, `EXCEL_SKILLS`/`EXCEL_SKILL_NAMES` — names match across all referencing tasks.
