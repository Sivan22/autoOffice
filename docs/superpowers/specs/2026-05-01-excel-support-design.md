# Excel support for AutoOffice — design spec

**Date:** 2026-05-01
**Status:** Draft, pending implementation plan
**Scope:** Extend AutoOffice (today: Word add-in) to also work as an Excel add-in, shipped as a single multi-host add-in.

## Goal

Users open AutoOffice in either Word or Excel from the same install. The agent in the task pane detects which host it is attached to and writes/executes the correct office.js code (`Word.run` or `Excel.run`) using API documentation grounded in that host's skill set.

## Decisions (locked in via brainstorming)

1. **Distribution:** single multi-host manifest (one Add-in ID, one task pane URL, one installer) — not separate manifests.
2. **Excel skill coverage:** full parity with Word — 21 Excel skill markdown files written up front (see Section 4).
3. **UI host indicator:** subtle Fluent UI `Badge` in the task pane header showing `Word` or `Excel`. No host-color tinting.

## Non-goals

- PowerPoint, Outlook, OneNote support (typed enum makes future addition a compile-time TODO list).
- Per-host settings (provider, API key, MCP). Settings are shared by design — one Add-in ID, one `roamingSettings` store.
- New UI features beyond the host badge.
- Changing the Word-side UX, skill content, or behavior in any way.

## 1. Host context & runtime detection

A single `HostContext` module is the source of truth for which Office app the task pane is attached to. Resolved once during `Office.onReady` in `index.tsx`, exposed as a typed enum:

```ts
// src/taskpane/host/context.ts
export type HostKind = 'word' | 'excel';
export interface HostContext { kind: HostKind; displayName: string; }
export function detectHost(): HostContext;
```

`detectHost` reads `Office.context.host`, maps `Office.HostType.Word → 'word'` and `Office.HostType.Excel → 'excel'`, and throws `Error("AutoOffice does not support this host: ${actual}")` for anything else. The thrown error is caught in `index.tsx` and rendered as a fatal task-pane message rather than allowed to silently produce broken `Word.run` calls inside the wrong host.

The resolved `HostContext` is plumbed top-down: `App.tsx` receives it on mount and passes it to the orchestrator, sandbox, skill registry, and the header badge. There must be exactly one call to `Office.context.host` in the entire codebase.

**Why a typed union, not a string:** the host gates code paths in the sandbox (`Word.run` vs `Excel.run`), in the skill registry (which markdown is valid), and in the system prompt. A typed union makes those switches exhaustive at the type level so adding PowerPoint later is a compile-time TODO list.

## 2. Manifest & distribution

One `manifest.xml` file declaring both hosts. The Add-in GUID stays the same (one logical add-in, one settings store).

```xml
<Hosts>
  <Host Name="Document" />
  <Host Name="Workbook" />
</Hosts>
```

Inside `VersionOverrides`, a second `<Host xsi:type="Workbook">` block is added alongside the existing `<Host xsi:type="Document">`. Each gets its own `OfficeTab` → `Group` → `Control` so the AutoOffice ribbon button appears on Word's Home tab and Excel's Home tab. Both buttons point to the same task pane URL and reuse the same icon resources. Same applies to `manifest.production.xml`.

Validation: as part of the implementation plan, run `office-addin-manifest validate` against both manifests. If validation rejects a multi-host file on the target Office version, fall back to two manifest files sharing one task pane URL (Plan B from brainstorming) — but do not preemptively split.

The installer (`setup.iss`, `autooffice.nsi`) is functionally unchanged: same trusted-catalog entry, same share, same single manifest file. Excel reads it and self-registers. Installer copy is updated from "Word add-in" → "Word & Excel add-in".

## 3. Sandbox / executor

Today `sandbox.ts` hard-codes `Word.run`. Becomes host-aware via constructor injection:

```ts
class Sandbox {
  constructor(private host: HostKind) {}
  async execute(code: string, timeout: number) {
    const ns = this.host === 'word' ? 'Word' : 'Excel';
    const trimmed = code.trim();
    const wrapped = trimmed.startsWith(`${ns}.run`)
      ? `return (${trimmed.replace(/;+\s*$/, '')});`
      : `return ${ns}.run(async function(context) {\n${code}\n});`;
    // ...rest unchanged
  }
}
```

**`iframe.html` note:** the file exists under `src/taskpane/executor/iframe.html` and is referenced by the README's architecture diagram, but `sandbox.ts` currently runs code via `new Function` in the parent task-pane window — the iframe is not wired into the execution path today. We update `iframe.html`'s wrapping logic for symmetry/future-proofing (in case the sandbox is moved into the iframe later) but the runtime behavior change for this work lives entirely in `sandbox.ts`. If we ever do route execution through the iframe, the host will be passed via the `execute` `postMessage` payload (not a one-time init) so there is no race against `Office.onReady` inside the iframe.

A pre-execution validation: if the user-submitted code contains `${otherNs}.run` (e.g. `Word.run` while we're in Excel), the sandbox returns a structured error before evaluation rather than letting the code throw a confusing "ReferenceError: Word is not defined" inside the runner. The error message tells the agent to retry with the correct namespace; this becomes one of its self-healing paths.

## 4. Skill registry restructure & Excel skill list

Files reorganized into per-host folders. Each host advertises only its own skills, eliminating any chance the agent calls `lookup_skill('tables')` and gets Word's docs while running in Excel:

```
src/taskpane/skills/
├── index.ts            ← host-aware: lookupSkill(host, name), listSkills(host)
├── word/               ← 19 existing files moved here, no content edits
│   ├── bookmarks.md
│   ├── comments.md
│   ├── content-controls.md
│   ├── context-sync.md
│   ├── document.md
│   ├── fields.md
│   ├── footnotes.md
│   ├── formatting.md
│   ├── headers-footers.md
│   ├── hyperlinks.md
│   ├── images.md
│   ├── lists.md
│   ├── ooxml.md
│   ├── page-setup.md
│   ├── ranges.md
│   ├── search.md
│   ├── styles.md
│   ├── tables.md
│   └── track-changes.md
└── excel/              ← new
    └── (21 files, see below)
```

`index.ts` exports:

```ts
export function listSkills(host: HostKind): readonly string[];
export function lookupSkill(host: HostKind, name: string): string;
```

The orchestrator reads `listSkills(host)` to interpolate into the system prompt and to constrain the `lookup_skill` tool's input enum.

### Excel skill set (21 files, full parity)

| # | Skill | Covers |
|---|---|---|
| 1 | `context-sync` | `Excel.run`, `load()`/`sync()`, `suspendApiCalculationUntilNextSync` for batched perf |
| 2 | `workbook` | top-level workbook ops, calculation mode, save, properties |
| 3 | `worksheets` | add/delete/activate/hide/rename, position, visibility, copy |
| 4 | `ranges` | get/set values, formulas; ranges by address vs name; getRow/Column; getResizedRange; getUsedRange |
| 5 | `formulas` | A1 vs R1C1, array formulas, dynamic arrays, calculate scope |
| 6 | `number-formats` | format codes, locale-aware, currency/date/percent/text |
| 7 | `formatting` | font, fill, borders, alignment, indent, wrap, row height, column width |
| 8 | `styles` | named cell styles, built-in vs custom |
| 9 | `tables` | ListObjects, structured refs, columns/rows, totals row, table style |
| 10 | `named-items` | named ranges and named formulas, scope (workbook vs worksheet) |
| 11 | `charts` | insert, type, series, axes, title, legend, position, size |
| 12 | `pivot-tables` | create, fields (row/column/value/filter), refresh, layout |
| 13 | `conditional-formatting` | rule types (cell value, color scale, data bar, icon set, custom), priority, range scoping |
| 14 | `data-validation` | rules, dropdowns, error alerts, input messages |
| 15 | `filters-sort` | AutoFilter, table filters, sort by column/custom criteria |
| 16 | `comments` | modern threaded comments, replies, resolve, mentions |
| 17 | `hyperlinks` | cell hyperlinks, types (url, document, email) |
| 18 | `images-shapes` | insert image, shape, position, size, z-order |
| 19 | `protection` | workbook/sheet protection, allowed actions, password |
| 20 | `events` | onChanged, onSelectionChanged, onActivated patterns |
| 21 | `ooxml` | `insertWorksheetsFromBase64` + base64 packaging notes |

Each file follows the structure of an existing Word skill: short overview, key types, common patterns with code examples, common mistakes. The implementation plan treats each Excel skill as its own checklist item.

## 5. Agent orchestrator & system prompt

`runAgent(...)` gains a `host: HostKind` parameter, passed down from `App.tsx`. The system prompt is built dynamically:

```ts
function buildSystemPrompt(host: HostKind, skills: readonly string[]): string {
  const hostName = host === 'word' ? 'Microsoft Word' : 'Microsoft Excel';
  const apiRoot = host === 'word' ? 'Word' : 'Excel';
  return `You are AutoOffice, an AI assistant that controls ${hostName} by writing and executing office.js code.

You have tools to look up API documentation and execute code.

Available skill topics for lookup_skill: ${skills.join(', ')}.

CRITICAL RULES for office.js code:
- You MUST load() properties before reading them
- You MUST await context.sync() after load() and before accessing values
- NEVER use DOM manipulation — only the office.js API
- Code is wrapped in ${apiRoot}.run(async (context) => { … }); you can write either the full block or just the inner body

When the user asks you to do something with the document:
1. ALWAYS call lookup_skill before writing code …
2. To read state, write execute_code that loads and returns the needed properties
3. Generate the code and call execute_code
4. If execution fails, analyze the error and try again (up to 3 attempts)`;
}
```

`lookupSkillTool` becomes a factory `makeLookupSkillTool(host)` so its description and input enum match the host's skill list. Same for `executeCodeTool`'s description (mention the right namespace).

`tools.ts`: refactor to export factories instead of singletons. Orchestrator constructs tools per call with the current host.

## 6. UI: host badge

In the existing task pane header (in `ChatPanel.tsx` or wherever the AutoOffice title lives), render a Fluent UI `Badge` next to the title showing the host's display name (`Word` or `Excel`). Sourced from the `HostContext` already passed into the component tree from `App.tsx`. Roughly 5–10 lines of JSX, no new state, neutral Fluent appearance.

## 7. Settings, build, README

- **Settings:** zero schema change. `roamingSettings` is per add-in ID; one ID means provider/API key/MCP/auto-approve are naturally shared between Word and Excel sessions, which matches user expectations.
- **Build / Vite:** zero change. Same single-page app, same output.
- **README:** title line "Word add-in" → "Word & Excel add-in"; comparison-table product description; architecture diagram caption; prerequisites ("Word on Web or Desktop" → "Word or Excel on Web or Desktop"); a one-sentence note that settings are shared between hosts by design.

## 8. Risks, open questions, mitigations

| Risk | Mitigation |
|---|---|
| Multi-host manifest rejected by older/on-prem Office builds | Plan-step runs `office-addin-manifest validate`; fall back to two-manifest distribution (same task pane URL) if validation fails on target Office versions. Do not preemptively split. |
| `Excel.run` not actually present in the sandbox at runtime | Smoke-test step in the implementation plan: open AutoOffice in Excel, run a trivial `Excel.run` no-op, confirm output. Block on green smoke before declaring Excel support working. |
| Skill content shallowness from writing 21 markdown files in one pass | Each Excel skill is its own checklist item in the implementation plan, not bundled. Pattern-match on the existing Word skill that maps closest (e.g. Excel `tables` follows Word `tables` shape). |
| User expects per-host settings (different provider for Excel vs Word) | Document explicitly in README that settings are shared by design. Not in scope for this work. |
| Iframe `postMessage` host handshake timing | Sandbox sends host on each `execute` message, not as a one-time init, so race conditions disappear. |

## 9. Implementation breakdown (rough sequencing — full plan TBD)

1. `HostContext` module + `detectHost`, wire through `App.tsx` (no behavior change yet).
2. Skill registry restructure: move 19 Word files into `skills/word/`; update `index.ts` to host-aware signature; add empty `skills/excel/` scaffold; verify Word still works end-to-end.
3. Sandbox + iframe host-aware wrapping; orchestrator + tools factory refactor; system prompt builder. Verify Word still works.
4. Manifest changes: add Workbook host blocks to both `manifest.xml` and `manifest.production.xml`; validate; smoke-test Excel sideload.
5. Header host badge.
6. Excel skills — 21 files, one per Section-4-table row. Each authored against the existing Word-skill template.
7. README + installer copy updates.
8. Final smoke test in both hosts; ship.

The implementation plan from `writing-plans` will turn this into discrete, testable steps with verification gates.
