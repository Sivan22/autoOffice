# PowerPoint Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AutoOffice from a Word + Excel multi-host add-in to a Word + Excel + PowerPoint multi-host add-in, with full coverage of `PowerPoint.run` (14 PowerPoint skill markdown files), runtime host detection, host-aware sandbox/orchestrator/system-prompt, and the existing host badge auto-rendering "PowerPoint".

**Architecture:** `HostKind` extends from `'word' | 'excel'` to `'word' | 'excel' | 'powerpoint'`. The exhaustive union turns "add PowerPoint" into a compile-time TODO list — every site that needs a third branch (sandbox, iframe, system prompt, skill registry, chat panel copy, orchestrator tool description) is flagged by the type checker. The sandbox's binary `otherNs` check is refactored to a namespace table so adding a fourth host later is one map entry. Skills live in `src/taskpane/skills/{word,excel,powerpoint}/`. The same multi-host `manifest.xml` declares `Document`, `Workbook`, and `Presentation`; one Add-in ID, one task pane URL, one installer.

**Tech Stack:** React 19 + TypeScript, Vite, Fluent UI v9, Vercel AI SDK, office.js (Word + Excel + PowerPoint), office-addin-debugging.

**Verification model:** This project has no automated test framework. Per-task verification gates are:
- **`npm run build`** (runs `tsc && vite build`) — TypeScript + bundler must succeed
- **Manual smoke test** in PowerPoint (and regression-smoke in Word and Excel) at host-touching milestones

Smoke test = sideload, open task pane, send a one-line command (e.g. "add a slide titled Hello"), watch the agent look up a skill, generate code, execute it, and confirm the presentation changed. Regression smoke = the same kind of test in Word and Excel still works after the change.

**Spec:** `docs/superpowers/specs/2026-05-02-powerpoint-support-design.md`

---

## File Structure

**New files:**
- `src/taskpane/skills/powerpoint/index.ts` — PowerPoint skill registry (parallel to `excel/index.ts`)
- `src/taskpane/skills/powerpoint/context-sync.md`
- `src/taskpane/skills/powerpoint/presentation.md`
- `src/taskpane/skills/powerpoint/slides.md`
- `src/taskpane/skills/powerpoint/slide-layouts.md`
- `src/taskpane/skills/powerpoint/shapes.md`
- `src/taskpane/skills/powerpoint/text.md`
- `src/taskpane/skills/powerpoint/tables.md`
- `src/taskpane/skills/powerpoint/images.md`
- `src/taskpane/skills/powerpoint/charts.md`
- `src/taskpane/skills/powerpoint/hyperlinks.md`
- `src/taskpane/skills/powerpoint/tags.md`
- `src/taskpane/skills/powerpoint/selection.md`
- `src/taskpane/skills/powerpoint/notes.md`
- `src/taskpane/skills/powerpoint/ooxml.md`

**Modified files:**
- `src/taskpane/host/context.ts` — add `'powerpoint'` to `HostKind` and `Office.HostType.PowerPoint` branch in `detectHost()`
- `src/taskpane/skills/index.ts` — host-aware lookup over a 3-host map (replaces binary check)
- `src/taskpane/executor/sandbox.ts` — namespace-table refactor (replaces binary `otherNs`)
- `src/taskpane/executor/iframe.html` — same namespace-table refactor in vanilla JS
- `src/taskpane/agent/system-prompt.ts` — three-way switch on `HostKind`, PowerPoint-specific guidance line
- `src/taskpane/agent/orchestrator.ts` — `execute_code` description references the right namespace for PowerPoint
- `src/taskpane/components/ChatPanel.tsx` — welcome example and placeholder branches for PowerPoint
- `manifest.xml` — add `Presentation` host
- `manifest.production.xml` — add `Presentation` host + update `Description`
- `package.json` — add `start:powerpoint` and `sideload:powerpoint` scripts; update `description`
- `installer/setup.iss` — display copy "Word & Excel" → "Word, Excel & PowerPoint"
- `installer/autooffice.nsi` — display copy + post-install message updated
- `README.md` — title, description, comparison table, prerequisites, sideload section, settings note

**Unchanged files (verified by inspection):**
- `src/taskpane/index.tsx` — already uses `detectHost()` and `UnsupportedHostError`; no edits needed
- `src/taskpane/App.tsx` — already plumbs `host: HostContext` top-down
- `src/taskpane/agent/tools.ts` — `makeLookupSkillTool(host)` already host-aware via `listSkills(host)`

---

## Phase 0 — Sanity baseline

### Task 0: Confirm a clean baseline

**Files:** none

- [ ] **Step 1: Verify build is green before any changes**

Run: `npm run build`
Expected: success (no TS errors, no Vite errors).

- [ ] **Step 2: Verify git working tree is clean**

Run: `git status`
Expected: nothing to commit.

If either fails, stop and fix before starting.

---

## Phase 1 — HostKind extension (compile-time TODO list)

The strategy: extend the type first and let `tsc` flag every site that needs a PowerPoint branch. Each downstream task in this phase fixes one of those sites.

### Task 1: Extend `HostKind` to include `'powerpoint'`

**Files:**
- Modify: `src/taskpane/host/context.ts`

- [ ] **Step 1: Update `context.ts`**

Replace the entire file contents with:

```ts
export type HostKind = 'word' | 'excel' | 'powerpoint';

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
    case Office.HostType.PowerPoint:
      return { kind: 'powerpoint', displayName: 'PowerPoint' };
    default:
      throw new UnsupportedHostError(String(Office.context.host));
  }
}
```

- [ ] **Step 2: Run `tsc` to surface every site that needs a PowerPoint branch**

Run: `npx tsc --noEmit`
Expected: a list of errors. Each is a downstream task. The exact files expected to error (verified by inspection):
- `src/taskpane/skills/index.ts` (binary `host === 'word' ? ... : ...` check)
- `src/taskpane/executor/sandbox.ts` (binary `host === 'word' ? 'Word' : 'Excel'`)
- `src/taskpane/agent/system-prompt.ts` (binary `host === 'word' ? 'Microsoft Word' : 'Microsoft Excel'` and similar)
- `src/taskpane/agent/orchestrator.ts` (binary `host === 'word' ? 'Word' : 'Excel'` in `execute_code` description)
- Any chat-panel copy that branches on host (welcome text, placeholder)

If `tsc` reports fewer errors than expected (e.g. because some branches default to one of the existing two hosts without a type-narrowing requirement), keep the list of those sites — they still need PowerPoint behavior even if not strictly required by the type checker, and Phase 1 still updates them.

- [ ] **Step 3: Do NOT commit yet**

This task intentionally leaves the project in a broken (non-compiling) state. The next tasks fix each site. Phase 1's final commit goes once everything compiles.

---

### Task 2: Sandbox namespace-table refactor

**Files:**
- Modify: `src/taskpane/executor/sandbox.ts`

- [ ] **Step 1: Replace the entire file contents with the namespace-table form**

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

const NS: Record<HostKind, 'Word' | 'Excel' | 'PowerPoint'> = {
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
};

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
    const ns = NS[this.host];
    const otherNamespaces = Object.values(NS).filter((n) => n !== ns);
    const trimmed = code.trim();

    // Reject code targeting the wrong host before running it. Yields a clear
    // error the agent can self-heal on, instead of an opaque "X is not defined".
    for (const other of otherNamespaces) {
      if (trimmed.startsWith(`${other}.run`)) {
        return {
          success: false,
          error: `Code uses ${other}.run but the add-in is running in ${ns}. Rewrite using ${ns}.run.`,
          logs: [],
        };
      }
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

---

### Task 3: System prompt three-way switch

**Files:**
- Modify: `src/taskpane/agent/system-prompt.ts`

- [ ] **Step 1: Replace the entire file contents**

```ts
// src/taskpane/agent/system-prompt.ts
import type { HostKind } from '../host/context.ts';

export function buildSystemPrompt(host: HostKind, skills: readonly string[]): string {
  const hostName =
    host === 'word' ? 'Microsoft Word' :
    host === 'excel' ? 'Microsoft Excel' :
    'Microsoft PowerPoint';
  const apiRoot =
    host === 'word' ? 'Word' :
    host === 'excel' ? 'Excel' :
    'PowerPoint';
  const insertEnumNote =
    host === 'word'
      ? '- You MUST use Word.InsertLocation enum for insertion positions'
      : host === 'excel'
        ? '- For inserting/clearing ranges, prefer typed Excel APIs (e.g. range.values = [[...]], range.clear()) over string concatenation'
        : '- Most edits go through shapes; many things (inserting tables, complex charts, new slides with arbitrary layout) require OOXML round-trips via presentation.insertSlidesFromBase64';

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

---

### Task 4: Orchestrator `execute_code` description three-way

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts:50-55`

- [ ] **Step 1: Update the `execute_code` tool description**

In `src/taskpane/agent/orchestrator.ts`, find the `executeCode` tool definition (currently around line 49). Replace the `description` block:

Old:
```ts
    description:
      'Submit generated office.js code for execution in the sandbox. ' +
      `The code can be either a complete ${host === 'word' ? 'Word' : 'Excel'}.run(async (context) => { ... }) block, ` +
      'or just the inner body (the executor wraps it automatically). ' +
      'Always use proper load() and context.sync() patterns. ' +
      'If you are unsure about the correct API, call lookup_skill first to get the right patterns and examples.',
```

New:
```ts
    description:
      'Submit generated office.js code for execution in the sandbox. ' +
      `The code can be either a complete ${host === 'word' ? 'Word' : host === 'excel' ? 'Excel' : 'PowerPoint'}.run(async (context) => { ... }) block, ` +
      'or just the inner body (the executor wraps it automatically). ' +
      'Always use proper load() and context.sync() patterns. ' +
      'If you are unsure about the correct API, call lookup_skill first to get the right patterns and examples.',
```

Leave the rest of the tool body unchanged.

---

### Task 5: Chat panel welcome + placeholder branches

**Files:**
- Modify: `src/taskpane/components/ChatPanel.tsx:160-166`
- Modify: `src/taskpane/components/ChatPanel.tsx:188-192`

- [ ] **Step 1: Update the welcome example block**

Find the existing block (currently around lines 160–166):

Old:
```tsx
<Text size={200}>
  {host.kind === 'word'
    ? 'Try: "Make all headings blue" or "Insert a 3-column table"'
    : 'Try: "Put 1 through 10 in column A" or "Make a chart from B2:D8"'}
</Text>
```

New:
```tsx
<Text size={200}>
  {host.kind === 'word'
    ? 'Try: "Make all headings blue" or "Insert a 3-column table"'
    : host.kind === 'excel'
      ? 'Try: "Put 1 through 10 in column A" or "Make a chart from B2:D8"'
      : 'Try: "Add a slide titled \'Q3 plan\' with three bullets" or "Make all slide titles bold"'}
</Text>
```

- [ ] **Step 2: Update the textarea placeholder**

Find the existing block (currently around line 190):

Old:
```tsx
placeholder={`Ask me to modify the ${host.kind === 'excel' ? 'workbook' : 'document'}...`}
```

New:
```tsx
placeholder={`Ask me to modify the ${
  host.kind === 'excel' ? 'workbook' : host.kind === 'powerpoint' ? 'presentation' : 'document'
}...`}
```

---

### Task 6: Create empty PowerPoint skill scaffold

**Files:**
- Create: `src/taskpane/skills/powerpoint/index.ts`

- [ ] **Step 1: Create `src/taskpane/skills/powerpoint/index.ts` as an empty registry**

```ts
// src/taskpane/skills/powerpoint/index.ts

export const POWERPOINT_SKILL_NAMES = [] as const;
export type PowerPointSkillName = (typeof POWERPOINT_SKILL_NAMES)[number];

export const POWERPOINT_SKILLS: Record<string, string> = {};
```

This is intentionally empty. Phase 3 (skill authoring) adds one entry per skill task. Task 7 imports from this file, so it must exist first.

---

### Task 7: Skill registry per-host map

**Files:**
- Modify: `src/taskpane/skills/index.ts`

- [ ] **Step 1: Replace the entire file contents**

```ts
// src/taskpane/skills/index.ts
import type { HostKind } from '../host/context.ts';
import { WORD_SKILLS, WORD_SKILL_NAMES } from './word/index.ts';
import { EXCEL_SKILLS, EXCEL_SKILL_NAMES } from './excel/index.ts';
import { POWERPOINT_SKILLS, POWERPOINT_SKILL_NAMES } from './powerpoint/index.ts';

const TABLES: Record<HostKind, Record<string, string>> = {
  word: WORD_SKILLS,
  excel: EXCEL_SKILLS,
  powerpoint: POWERPOINT_SKILLS,
};

const NAMES: Record<HostKind, readonly string[]> = {
  word: WORD_SKILL_NAMES,
  excel: EXCEL_SKILL_NAMES,
  powerpoint: POWERPOINT_SKILL_NAMES,
};

export function listSkills(host: HostKind): readonly string[] {
  return NAMES[host];
}

export function lookupSkill(host: HostKind, name: string): string {
  const table = TABLES[host];
  const content = table[name];
  if (!content) {
    const available = listSkills(host).join(', ');
    return `Skill "${name}" not found for host "${host}". Available: ${available}`;
  }
  return content;
}
```

---

### Task 8: Iframe namespace-table refactor

**Files:**
- Modify: `src/taskpane/executor/iframe.html`

- [ ] **Step 1: Replace the entire file contents**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <script src="https://appsforoffice.microsoft.com/lib/1.1/hosted/office.js"></script>
</head>
<body>
<script>
  var NS = { word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint' };

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'execute' || !data.id) return;

    var id = data.id;
    var code = data.code;
    var hostKey = NS.hasOwnProperty(data.host) ? data.host : 'word'; // default word for back-compat
    var ns = NS[hostKey];

    var trimmed = code.trim();
    for (var key in NS) {
      if (!NS.hasOwnProperty(key)) continue;
      var other = NS[key];
      if (other === ns) continue;
      if (trimmed.indexOf(other + '.run') === 0) {
        parent.postMessage({
          type: 'error', id: id, success: false,
          error: 'Code uses ' + other + '.run but host is ' + ns + '. Rewrite using ' + ns + '.run.',
          logs: []
        }, '*');
        return;
      }
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
</body>
</html>
```

This is a static asset with no TS impact, but the change keeps it symmetric with `sandbox.ts` so that if execution is ever moved into the iframe, no further wiring is needed.

---

### Task 9: Build green + Phase-1 commit

**Files:** none

- [ ] **Step 1: Run `npm run build`**

Run: `npm run build`
Expected: `tsc && vite build` both succeed. No type errors.

If this fails, do NOT proceed. Find the missing site, branch on `host.kind === 'powerpoint'` (or extend a switch) following the patterns in Tasks 2–5, then re-run.

- [ ] **Step 2: Smoke test in Word (regression)**

Run: `npm run sideload`. Send "make the first paragraph bold". Confirm normal behavior.

- [ ] **Step 3: Smoke test in Excel (regression)**

Run: `npm run sideload:excel`. Send "put 'hello' in A1". Confirm normal behavior.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/host/context.ts \
        src/taskpane/executor/sandbox.ts \
        src/taskpane/executor/iframe.html \
        src/taskpane/agent/system-prompt.ts \
        src/taskpane/agent/orchestrator.ts \
        src/taskpane/components/ChatPanel.tsx \
        src/taskpane/skills/index.ts \
        src/taskpane/skills/powerpoint/index.ts
git commit -m "Extend HostKind to powerpoint; refactor sandbox namespace check to a table"
```

---

## Phase 2 — Manifest, scripts, and PowerPoint smoke

PowerPoint sideload must work end-to-end with the empty skill registry before any skills are written. This phase confirms the host wiring before investing 14 markdown files.

### Task 10: Add PowerPoint host to dev manifest

**Files:**
- Modify: `manifest.xml`

- [ ] **Step 1: Add `Presentation` to the top-level `Hosts` block**

Replace lines 19–22:

Old:
```xml
  <Hosts>
    <Host Name="Document" />
    <Host Name="Workbook" />
  </Hosts>
```

New:
```xml
  <Hosts>
    <Host Name="Document" />
    <Host Name="Workbook" />
    <Host Name="Presentation" />
  </Hosts>
```

- [ ] **Step 2: Add a `Presentation` `VersionOverrides` `Host` block**

Inside `VersionOverrides` → `Hosts`, after the closing `</Host>` of the `Workbook` block (currently around line 105) and before `</Hosts>`, insert:

```xml
      <Host xsi:type="Presentation">
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title" />
            <Description resid="GetStarted.Description" />
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl" />
          </GetStarted>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="AutoOfficeGroupPowerPoint">
                <Label resid="CommandsGroup.Label" />
                <Icon>
                  <bt:Image size="16" resid="Icon.16x16" />
                  <bt:Image size="32" resid="Icon.32x32" />
                  <bt:Image size="80" resid="Icon.80x80" />
                </Icon>
                <Control xsi:type="Button" id="TaskpaneButtonPowerPoint">
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

- [ ] **Step 3: Update top-level `Description`**

Replace line 14:

Old:
```xml
  <Description DefaultValue="AI-powered dynamic code execution add-in for Microsoft Word and Excel" />
```

New:
```xml
  <Description DefaultValue="AI-powered dynamic code execution add-in for Microsoft Word, Excel, and PowerPoint" />
```

- [ ] **Step 4: Validate the manifest**

Run: `npx office-addin-manifest validate manifest.xml`
Expected: validation passes with no errors. Warnings about missing `MinVersion` etc. are acceptable.

If validation rejects the three-host file (rare on current Office tooling but possible on older builds), STOP. The fallback per the spec §2 is to split into a Word+Excel manifest plus a PowerPoint manifest sharing one task pane URL — but do not split preemptively. Report the validation failure and discuss before continuing.

---

### Task 11: Add PowerPoint host to production manifest

**Files:**
- Modify: `manifest.production.xml`

- [ ] **Step 1: Apply the same three changes as Task 10**

Repeat exactly: top-level `Hosts` adds `<Host Name="Presentation" />`; `VersionOverrides` gains the `<Host xsi:type="Presentation">` block (same body as in Task 10); `Description` is updated.

- [ ] **Step 2: Validate**

Run: `npx office-addin-manifest validate manifest.production.xml`
Expected: passes.

---

### Task 12: Add npm scripts for PowerPoint sideload

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts and update description**

In `package.json`, change `description`:

Old: `"description": "AI-powered dynamic code execution add-in for Microsoft Word",`
New: `"description": "AI-powered dynamic code execution add-in for Microsoft Word, Excel, and PowerPoint",`

In the `scripts` block, after the existing `sideload:excel` line, add:

```json
"start:powerpoint":    "office-addin-debugging start manifest.xml --app powerpoint",
"sideload:powerpoint": "office-addin-debugging start manifest.xml desktop --no-debug --app powerpoint",
```

The full `scripts` block after the change:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "certs": "office-addin-dev-certs install",
  "start": "office-addin-debugging start manifest.xml --app word",
  "start:excel": "office-addin-debugging start manifest.xml --app excel",
  "start:powerpoint": "office-addin-debugging start manifest.xml --app powerpoint",
  "stop": "office-addin-debugging stop manifest.xml",
  "sideload": "office-addin-debugging start manifest.xml desktop --no-debug --app word",
  "sideload:excel": "office-addin-debugging start manifest.xml desktop --no-debug --app excel",
  "sideload:powerpoint": "office-addin-debugging start manifest.xml desktop --no-debug --app powerpoint"
}
```

---

### Task 13: PowerPoint sideload smoke (with empty skill registry)

**Files:** none

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 2: Sideload into PowerPoint**

Run: `npm run sideload:powerpoint`
Expected: PowerPoint launches; AutoOffice button is visible on the Home tab; clicking opens the task pane; the host badge in the header reads "PowerPoint".

- [ ] **Step 3: Trivial PowerPoint.run smoke**

In the chat panel, send: `print the title of the active presentation`.

The agent will fail to find a `lookup_skill` topic (the registry is empty) and may write code without grounding. That's OK. What we're verifying:
- The task pane loads in PowerPoint without a fatal "unsupported host" screen.
- The orchestrator can `execute_code` and the sandbox wraps with `PowerPoint.run`.
- A trivial PowerPoint API call (e.g. `context.presentation.load("title"); await context.sync(); return context.presentation.title;`) returns a result, not "PowerPoint is not defined".

If `PowerPoint` is undefined in the sandbox, this is a **Risk §8 condition**: the user's PowerPoint version doesn't expose `PowerPoint.run`. Stop and report; do not author skills against a runtime that won't execute them.

- [ ] **Step 4: Regression smoke in Word + Excel**

Re-run `npm run sideload` and `npm run sideload:excel`. Confirm both still work with a one-line command each.

- [ ] **Step 5: Commit**

```bash
git add manifest.xml manifest.production.xml package.json
git commit -m "Add PowerPoint (Presentation) host to manifest; add sideload:powerpoint scripts"
```

---

## Phase 3 — PowerPoint skill authoring

Each skill is its own task. Each task has the same shape and uses the same reusable register-build-commit footer.

### Reusable per-skill pattern

For every skill task in Phase 3, the steps are:

1. **Author the markdown file** — write `src/taskpane/skills/powerpoint/<name>.md` covering the bullet outline given in the task. Pattern-match on the most-similar Word or Excel skill (e.g. `excel/context-sync.md` for `powerpoint/context-sync.md`). Each file has these sections (skip a section only if genuinely N/A):
   - Short overview (1–3 sentences)
   - Key Types
   - One or more "How X works" / pattern sections, each with at least one runnable code example inside `PowerPoint.run`
   - Common Mistakes (4–8 bullets)

2. **Register the skill** in `src/taskpane/skills/powerpoint/index.ts`:
   - Add `import <camelName> from './<file-name>.md?raw';` at the top.
   - Append `'<file-name>'` to `POWERPOINT_SKILL_NAMES`.
   - Add `'<file-name>': <camelName>,` to `POWERPOINT_SKILLS`.

3. **Build**: `npm run build` — expected: success.

4. **Commit**: `git add src/taskpane/skills/powerpoint/<name>.md src/taskpane/skills/powerpoint/index.ts && git commit -m "Add PowerPoint skill: <name>"`.

The skill tasks below each give the bullet outline of what the markdown must cover. Skill order is chosen so each skill builds on prior context.

---

### Task 14: PowerPoint skill — `context-sync`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/context-sync.md`** — must cover:
  - `PowerPoint.RequestContext` and `context.presentation` as the entry point inside `PowerPoint.run`
  - Proxy object model: properties are not populated until `load()` + `await context.sync()`
  - One example: load `presentation.title` and read it back
  - Difference from `Excel.run`: `PowerPoint.run` callbacks similarly auto-sync at the end, but most reads still need explicit `load + sync`
  - Loading a collection: `presentation.slides.load("items/id")`, then iterate `slides.items`
  - Avoiding sync inside loops (same anti-pattern as Word/Excel)
  - Common mistakes: reading proxy properties before sync; calling sync inside a `for` loop; assuming the final auto-sync brings values back to the client

- [ ] **Step 2: Register `'context-sync'` in `powerpoint/index.ts`. Step 3: Build. Step 4: Commit.**

After this task, `powerpoint/index.ts` looks like:

```ts
// src/taskpane/skills/powerpoint/index.ts
import contextSync from './context-sync.md?raw';

export const POWERPOINT_SKILL_NAMES = [
  'context-sync',
] as const;
export type PowerPointSkillName = (typeof POWERPOINT_SKILL_NAMES)[number];

export const POWERPOINT_SKILLS: Record<string, string> = {
  'context-sync': contextSync,
};
```

For each subsequent skill, add the import line, append the name, and add the entry — same shape.

---

### Task 15: PowerPoint skill — `presentation`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/presentation.md`** — must cover:
  - `context.presentation` properties: `title`, `slides`, `slideMasters`, `tags`
  - Methods: `getSelectedSlides()`, `getSelectedShapes()`, `getSelectedTextRange()`, `insertSlidesFromBase64(base64File, options?)`
  - Loading and reading `title`
  - One example: log title and slide count
  - Note: many "presentation-level" operations (saving, exporting full deck) are not exposed by `PowerPoint.run` — point to `ooxml` skill for round-trip patterns
  - Common mistakes: assuming a `presentation.save()` exists; treating `title` as the file name (it's the slide-master title, not the file name)

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 16: PowerPoint skill — `slides`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/slides.md`** — must cover:
  - `presentation.slides` collection: `getItemAt(index)`, `getItemOrNullObject(id)`, `load("items/id")`
  - Slide identity: `slide.id` (string)
  - Per-slide methods: `delete()`, `moveTo(index)`, `duplicate()`, `exportAsBase64()`
  - Per-slide properties: `layout`, `slideMaster`, `shapes`, `tags`
  - Adding new slides: `presentation.insertSlidesFromBase64(...)` is the path (no direct `slides.add()`); cross-link to `ooxml` skill
  - One example: iterate slides, log id and shape count
  - One example: delete slide at index 2
  - One example: duplicate the active slide and move the copy to the end
  - Common mistakes: assuming `slides.add()` exists; treating `getItemAt` index as 1-based (it's 0-based); `moveTo` index ambiguity

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 17: PowerPoint skill — `slide-layouts`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/slide-layouts.md`** — must cover:
  - `presentation.slideMasters` collection
  - `SlideMaster` properties: `id`, `name`, `layouts`
  - `SlideLayout` properties: `id`, `name`
  - `slide.layout` and `slide.slideMaster` proxy navigation
  - Listing all layouts under a master: `master.layouts.load("items/id, items/name")`
  - Applying a layout to a slide (when supported in the API surface; if not, document as a gap and steer to OOXML)
  - One example: list every layout name across every master
  - Common mistakes: assuming layout `name` is unique across masters; assuming the active slide's layout can be reassigned via direct property write — verify before relying on it

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 18: PowerPoint skill — `shapes` (high-frequency skill — invest extra detail)

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/shapes.md`** — must cover:
  - `slide.shapes` collection: `getItemAt`, `getItemOrNullObject`, `load("items/id, items/name, items/type")`
  - `Shape.type` enum values: `GeometricShape`, `Image`, `Table`, `Chart`, `Placeholder`, `Group`, `Line`, `SmartArt`, `Unsupported` (etc.)
  - Geometry props: `top`, `left`, `width`, `height`, `rotation` — all in points (1/72 inch)
  - `Shape.geometricShapeType` enum (Rectangle, Oval, RoundedRectangle, Triangle, etc.)
  - Identity props: `name`, `id`, `parentSlide`
  - Placeholder handling: `Shape.placeholder` (null when not a placeholder)
  - `Shape.delete()`
  - One example: insert a rectangle (via `slide.shapes.addGeometricShape(...)`), set position and fill color
  - One example: iterate all shapes on the active slide and log type + position
  - One example: delete every image shape on the active slide
  - Common mistakes: assuming `Shape.type === 'Text'` exists (text lives on a shape's `textFrame`, not as a separate type); confusing points with pixels; setting size before checking the shape supports resize (groups, locked placeholders); forgetting to load `type` before switching on it

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 19: PowerPoint skill — `text` (high-frequency skill — invest extra detail)

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/text.md`** — must cover:
  - `Shape.textFrame` (`TextFrame`) — proxy to text content of a shape; not all shape types have one
  - `textFrame.textRange` — full body text as a `TextRange`
  - `TextRange`: `text`, `paragraphs`, `font`, `setText(text)`, `getSubstring(start, length)`
  - `Paragraph`: `bulletFormat`, `horizontalAlignment`, `indentLevel`, `font`
  - `ShapeFont` / `TextRange.font`: `name`, `size`, `bold`, `italic`, `underline`, `color`
  - Bullets vs numbered: `paragraph.bulletFormat.type` (Solid, Numbered, Picture, etc.)
  - `textFrame.autoSizeSetting`, `textFrame.wordWrap`
  - One example: set the title placeholder text on the active slide
  - One example: make every paragraph in the active slide's body bold + 18pt
  - One example: replace text content of a named shape
  - Common mistakes: treating `textFrame.textRange.text = "..."` as creating a paragraph (it replaces all paragraphs); reading `font.color` before sync; assuming shapes without a textFrame return an empty string (they throw — guard with type check)

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 20: PowerPoint skill — `tables`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/tables.md`** — must cover:
  - **Limitation up front:** `PowerPoint.run` does not expose a typed table-creation API as of this writing. To insert a new table, package OOXML and call `presentation.insertSlidesFromBase64(...)` — point to the `ooxml` skill.
  - Reading existing table shapes: detect via `Shape.type === 'Table'`; access cells/rows is limited at the typed API level
  - Pattern: when asked to "add a table", round-trip via OOXML; when asked to read/modify a table that already exists, prefer reading via shape `name` and mutating shape-level properties (position, size) only
  - One example: list all table-typed shapes on a slide
  - One example (commented as OOXML round-trip): produce a base64 .pptx with a 3×3 table and call `insertSlidesFromBase64`
  - Common mistakes: assuming `slide.shapes.addTable(rows, cols)` exists; trying to set cell text directly on a table shape's `textFrame` (it doesn't reach cells)

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 21: PowerPoint skill — `images`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/images.md`** — must cover:
  - Inserting an image: `slide.shapes.addImage(base64String)` — note: argument is the base64-encoded image data (PNG/JPEG), not a URL
  - Sizing/positioning the returned `Shape`: set `top`, `left`, `width`, `height`
  - Reading an existing image: detect via `Shape.type === 'Image'`; `shape.image.getImageAsBase64()` returns a `ClientResult<string>` — must call `await context.sync()` before reading `.value`
  - Replacing an image: typically delete + re-insert at same position/size
  - One example: insert a base64 image and place it at (100, 100) with width 300
  - One example: extract every image from the active slide as base64 strings
  - Common mistakes: passing a `data:` URI prefix (must be raw base64); reading `getImageAsBase64()` synchronously; not awaiting sync before reading `ClientResult.value`

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 22: PowerPoint skill — `charts`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/charts.md`** — must cover:
  - **Limitation up front:** `PowerPoint.run` exposes chart shapes (`Shape.type === 'Chart'`) but does not provide a typed chart-creation API. To add a chart, OOXML round-trip via `presentation.insertSlidesFromBase64(...)` is the path.
  - Reading existing chart shapes: detect via type; geometry props (top/left/width/height) work as for any shape
  - Embedded Excel charts: charts on PowerPoint slides are typically backed by an embedded Excel workbook; PowerPoint.run does not expose that workbook
  - Pattern: "add a column chart from these numbers" → OOXML round-trip with the chart pre-built
  - One example: list all chart-typed shapes on a slide
  - One example (OOXML round-trip): construct a base64 .pptx containing a chart slide, call `insertSlidesFromBase64`
  - Common mistakes: assuming `addChart()` exists; trying to set chart series via shape properties; expecting chart data to be queryable via PowerPoint.run

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 23: PowerPoint skill — `hyperlinks`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/hyperlinks.md`** — must cover:
  - `Shape.hyperlink` (`Hyperlink` proxy): `address` (URL), `screenTip`, `tooltip`
  - `TextRange.hyperlinks` collection: per-character or per-run hyperlinks within text
  - Hyperlink target types: external URL, mailto, slide jump (`#slide=N` style addresses where supported)
  - Setting a shape-level hyperlink: `shape.hyperlink.address = "https://..."`
  - Removing: setting address to empty string, or per the API surface
  - One example: add a hyperlink to the title shape pointing to a URL
  - One example: read all hyperlinks on the active slide
  - Common mistakes: setting hyperlink on a shape without sync; conflating shape-level and text-range hyperlinks (text-range wins on overlap); assuming `mailto:` addresses get auto-prefixed (they don't)

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 24: PowerPoint skill — `tags`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/tags.md`** — must cover:
  - `Tags` collection lives on `presentation`, `slide`, and `shape` — same API shape on all three
  - Methods: `add(key, value)`, `getItem(key)`, `getItemOrNullObject(key)`, `delete(key)`, `load("items/key, items/value")`
  - Use cases: persisting non-visual metadata (e.g. "this slide is the agenda", "this shape is a placeholder for the user's name")
  - Tags survive save/reopen; key is case-sensitive (verify)
  - One example: tag the active slide with `kind=agenda`, then later find it by iterating slide tags
  - One example: list all tags on the active slide
  - Common mistakes: relying on tag iteration order; storing large blobs as tag values (string-only, modest size); confusing `Tag.value` with `Tag.key`

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 25: PowerPoint skill — `selection`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/selection.md`** — must cover:
  - `presentation.getSelectedSlides()` → `SlideScopedCollection`
  - `presentation.getSelectedShapes()` → `ShapeScopedCollection`
  - `presentation.getSelectedTextRange()` → `TextRange` (or null if no text is selected)
  - All selection getters return collection/object proxies — load before reading
  - Empty/null handling: when nothing is selected, the returned collection has zero items; `getSelectedTextRange()` may throw or return a null object — guard accordingly
  - "Operate on what the user selected" pattern: when the user says "make this bold", read the selected text range first, fall back to selected shapes' text frames if no text range
  - One example: bold the currently selected text
  - One example: delete every currently selected shape
  - Common mistakes: assuming a selection is always present; calling `getSelectedTextRange()` without a try/catch when no text is selected; assuming the selection is mutable (you can read it, but write through the underlying objects)

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 26: PowerPoint skill — `notes`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/notes.md`** — must cover:
  - Speaker notes are per-slide; access via `slide.notesPage` (a `SlideLayout`-like object)
  - `notesPage.shapes` contains the notes placeholder; the body shape's `textFrame.textRange.text` holds the notes text
  - Reading notes: navigate `slide → notesPage → shapes → find body placeholder → textFrame.textRange.text`
  - Writing notes: the same path, set `textFrame.textRange.text = "..."`
  - Limitation: rich formatting in notes is supported via the same TextRange API but is rarely useful
  - One example: read speaker notes from every slide
  - One example: append "TODO: review" to the active slide's notes
  - Common mistakes: assuming `slide.notes` is a string property (it isn't); writing to the notes page's title placeholder by accident (find the body explicitly); not all slides have a notes shape — guard with null-object pattern

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

---

### Task 27: PowerPoint skill — `ooxml`

- [ ] **Step 1: Author `src/taskpane/skills/powerpoint/ooxml.md`** — must cover:
  - `presentation.insertSlidesFromBase64(base64File, options?)` — primary OOXML round-trip entry point
  - Options: `targetSlideId` (insert position), `formatting` (`UseDestinationTheme` | `KeepSourceFormatting`)
  - The base64 string must be a complete `.pptx` file (zip of the OOXML package), not a single slide XML fragment
  - Use cases: inserting tables, charts, SmartArt, custom-formatted slides — anything not exposed by typed `PowerPoint.run` APIs
  - Pattern: build the `.pptx` server-side or in the agent, base64-encode, call `insertSlidesFromBase64`
  - Pattern: extract one slide via `slide.exportAsBase64()`, modify externally, re-import
  - One example: minimal `insertSlidesFromBase64` call (assumes a base64 string is in scope) targeting position 2, using `KeepSourceFormatting`
  - Brief note on building OOXML: the OOXML SDK is out of scope for this skill; the agent should defer to a user-supplied base64 blob or to a known template
  - Common mistakes: passing a single XML file instead of a full `.pptx` zip; forgetting `await context.sync()` after the call; assuming `targetSlideId` is an index (it's a slide ID string)

- [ ] **Step 2: Register; Step 3: Build; Step 4: Commit.**

After this task, `src/taskpane/skills/powerpoint/index.ts` registers all 14 skills.

---

## Phase 4 — Polish: installer, README, end-to-end smoke

### Task 28: Update installer copy

**Files:**
- Modify: `installer/setup.iss`
- Modify: `installer/autooffice.nsi`

- [ ] **Step 1: Update `installer/setup.iss`**

Find line 5 (`#define MyAppName "AutoOffice for Word & Excel"`) and change to:
```
#define MyAppName "AutoOffice for Word, Excel & PowerPoint"
```

Find the Hebrew `FinishedLabel` line (currently around line 178) and update the in-text app names from "Word או Excel" to "Word, Excel או PowerPoint", and "פתח את Microsoft Word או Excel" to "פתח את Microsoft Word, Excel או PowerPoint".

- [ ] **Step 2: Update `installer/autooffice.nsi`**

Find line 8 (`Name "${APPNAME} Add-in for Word & Excel"`) and change to:
```
Name "${APPNAME} Add-in for Word, Excel & PowerPoint"
```

Find the post-install MessageBox line (currently around line 38) and change "Restart Microsoft Word or Excel" to "Restart Microsoft Word, Excel or PowerPoint".

- [ ] **Step 3: Commit**

```bash
git add installer/setup.iss installer/autooffice.nsi
git commit -m "Update installer copy to mention Word, Excel & PowerPoint"
```

---

### Task 29: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update tagline (line 7)**

Old:
```
<p align="center">AI-powered Microsoft Word + Excel add-in that writes and executes real <code>office.js</code> code on demand.</p>
```

New:
```
<p align="center">AI-powered Microsoft Word + Excel + PowerPoint add-in that writes and executes real <code>office.js</code> code on demand.</p>
```

- [ ] **Step 2: Update product description (line 11)**

Add a PowerPoint example. Replace:
```
AutoOffice is a task-pane add-in you chat with. Describe what you want — for Word ("make all headings blue", "insert a 3-column table") or Excel ("put 1 through 10 in column A", "build a column chart from B2:D8") — and the agent:
```

With:
```
AutoOffice is a task-pane add-in you chat with. Describe what you want — for Word ("make all headings blue", "insert a 3-column table"), Excel ("put 1 through 10 in column A", "build a column chart from B2:D8"), or PowerPoint ("add a slide titled 'Q3 plan' with three bullets", "make every slide title bold") — and the agent:
```

- [ ] **Step 3: Update "Multi-doc context" comparison row (line 32)**

Old:
```
| **Multi-doc context** | ❌ (Word + Excel, single-doc) | ✅ all M365 apps | ✅ Word + Excel + PowerPoint | ❌ |
```

New:
```
| **Multi-doc context** | ❌ (Word + Excel + PowerPoint, single-doc) | ✅ all M365 apps | ✅ Word + Excel + PowerPoint | ❌ |
```

- [ ] **Step 4: Update architecture sentence (line 58)**

Old:
```
The same task pane runs in Word and Excel; `HostContext` is resolved at startup and gates the skill registry, sandbox wrapping, and system prompt per host.
```

New:
```
The same task pane runs in Word, Excel, and PowerPoint; `HostContext` is resolved at startup and gates the skill registry, sandbox wrapping, and system prompt per host.
```

- [ ] **Step 5: Update prerequisites (line 65)**

Old:
```
- Microsoft 365 (Word or Excel — Web or Desktop)
```

New:
```
- Microsoft 365 (Word, Excel, or PowerPoint — Web or Desktop)
```

- [ ] **Step 6: Add a PowerPoint sideload section after the Excel one (after line 105)**

After the existing Excel sideload block, insert:

```markdown
### Run + sideload PowerPoint

Same scripts but targeting PowerPoint:

```bash
npm run start:powerpoint       # debugger
npm run sideload:powerpoint    # no debugger
```
```

- [ ] **Step 7: Update settings-shared note (line 194)**

Old:
```
Settings are persisted via `Office.context.roamingSettings` when running inside Office, and `localStorage` during development. Provider, API key, MCP server, and other settings are shared between Word and Excel by design — there is one logical add-in per install.
```

New:
```
Settings are persisted via `Office.context.roamingSettings` when running inside Office, and `localStorage` during development. Provider, API key, MCP server, and other settings are shared across Word, Excel, and PowerPoint by design — there is one logical add-in per install.
```

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "Document PowerPoint support in README"
```

---

### Task 30: Final tri-host smoke test

**Files:** none

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: success, no warnings about missing skill imports.

- [ ] **Step 2: Smoke test in Word**

Run: `npm run sideload`. Send: `make the first paragraph bold`.
Expected: agent calls `lookup_skill` for a Word skill, generates code, executes successfully. Document changes.

- [ ] **Step 3: Smoke test in Excel**

Run: `npm run sideload:excel`. Send: `put hello in A1`.
Expected: agent calls `lookup_skill` for an Excel skill, generates code, executes successfully. Cell A1 reads "hello".

- [ ] **Step 4: Smoke test in PowerPoint**

Run: `npm run sideload:powerpoint`. Send: `add a new slide and put 'Hello world' as its title`.
Expected: agent calls `lookup_skill` (e.g. `slides`, `presentation`, or `ooxml`), generates code, executes successfully. A new slide with that title appears in the deck.

If the agent's code uses `slides.add()` and fails with "not a function", that's expected — it should self-heal by calling `lookup_skill('ooxml')` and round-tripping. If it can't find the OOXML path on its own, that's a content-quality issue with the `ooxml` and `slides` skills — sharpen the language in those files (e.g. make it explicit in `slides.md` that "no `slides.add()` exists; use `presentation.insertSlidesFromBase64`").

- [ ] **Step 5: Cross-host wrong-namespace check**

In PowerPoint, send: `Use Word.run to set bold`.
Expected: the sandbox's namespace check rejects the code with "Code uses Word.run but the add-in is running in PowerPoint. Rewrite using PowerPoint.run." The agent should then self-heal.

- [ ] **Step 6: Final commit (if anything was tweaked during smoke)**

If you adjusted any skill markdown to fix agent behavior during smoke, commit those tweaks now:

```bash
git add src/taskpane/skills/powerpoint/
git commit -m "Tighten PowerPoint skill content based on smoke-test feedback"
```

If nothing was tweaked, no commit is needed — the work is already on master.

---

## Done

- HostKind extended to `'powerpoint'`; sandbox + iframe + system prompt + chat panel + skill registry all branch on it.
- Manifest declares `Document`, `Workbook`, and `Presentation`; `npm run sideload:powerpoint` works.
- 14 PowerPoint skill files cover the full `PowerPoint.run` surface.
- Installer + README + `package.json` describe the three-host product.
- All three hosts smoke-test green.
