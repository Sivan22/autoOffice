# PowerPoint support for AutoOffice — design spec

**Date:** 2026-05-02
**Status:** Draft, pending implementation plan
**Scope:** Extend AutoOffice (today: Word + Excel) to also work as a PowerPoint add-in, shipped as the same single multi-host add-in.

## Goal

Users open AutoOffice in Word, Excel, *or* PowerPoint from the same install. The agent in the task pane detects which host it is attached to and writes/executes the correct office.js code (`Word.run`, `Excel.run`, or `PowerPoint.run`) using API documentation grounded in that host's skill set.

## Decisions (locked in via brainstorming)

1. **Distribution:** continue with the single multi-host manifest. Add a third `<Host Name="Presentation" />` entry. One Add-in ID, one task pane URL, one installer.
2. **PowerPoint skill coverage:** full coverage of `PowerPoint.run` — 14 skill markdown files written up front (Section 4).
3. **UI host indicator:** existing host badge auto-extends. The badge will read `PowerPoint` when running inside PowerPoint.

## Non-goals

- Outlook, OneNote support (still a compile-time TODO via the typed `HostKind` enum).
- Per-host settings — `roamingSettings` continues to be shared across Word, Excel, and PowerPoint by design.
- Animations, transitions, slide-show controls — not exposed by `PowerPoint.run`.
- Modifying any Word- or Excel-side UX, skill content, or behavior.

## 1. Host context & runtime detection

`HostKind` extends from `'word' | 'excel'` to `'word' | 'excel' | 'powerpoint'`. `detectHost` adds:

```ts
case Office.HostType.PowerPoint:
  return { kind: 'powerpoint', displayName: 'PowerPoint' };
```

The dev fallback (no `Office.context`, e.g. plain Vite preview) still returns `'word'` so existing dev flow is unchanged.

`UnsupportedHostError` continues to catch Outlook, OneNote, Project, etc.

**Why a typed union, not a string:** the host gates code paths in the sandbox (`Word.run` vs `Excel.run` vs `PowerPoint.run`), in the skill registry (which markdown is valid), and in the system prompt. The exhaustive union turns "add PowerPoint" into a compile-time TODO list — every site that needs a third branch is flagged by the type checker. Sites already enumerated by inspection: `sandbox.ts`, `executor/iframe.html`, `agent/system-prompt.ts`, `skills/index.ts`, plus any chat-panel copy that branches on host.

## 2. Manifest & distribution

Both `manifest.xml` and `manifest.production.xml`:

```xml
<Hosts>
  <Host Name="Document" />
  <Host Name="Workbook" />
  <Host Name="Presentation" />
</Hosts>
```

Inside `VersionOverrides`, add a third `<Host xsi:type="Presentation">` block alongside the existing `Document` and `Workbook`. Same shape as the existing two: its own `OfficeTab` (`TabHome`), `Group` (e.g. `AutoOfficeGroupPowerPoint`), and `Control` (e.g. `TaskpaneButtonPowerPoint`), pointing to the same `Taskpane.Url` and reusing the same icon resources.

Update the manifest `Description`: `"AI-powered dynamic code execution add-in for Microsoft Word, Excel, and PowerPoint"`. Same in `package.json` `description`.

Validation: implementation plan runs `office-addin-manifest validate` against both manifests. If multi-host validation rejects three hosts on the target Office version, fall back to a two-manifest split (one for Word+Excel, one for PowerPoint) sharing the same task pane URL — but do not preemptively split.

`package.json` adds:

```json
"start:powerpoint":    "office-addin-debugging start manifest.xml --app powerpoint",
"sideload:powerpoint": "office-addin-debugging start manifest.xml desktop --no-debug --app powerpoint"
```

The installer is functionally unchanged: same trusted-catalog entry, same share, same single manifest file. PowerPoint reads it and self-registers. Installer copy ("Word & Excel add-in") becomes "Word, Excel & PowerPoint add-in".

## 3. Sandbox / executor

Today `sandbox.ts` and `iframe.html` switch on `host === 'excel' ? 'Excel' : 'Word'` and reject "the other" namespace. With three hosts, the binary `otherNs` no longer makes sense. Refactor to a namespace table:

```ts
const NS: Record<HostKind, 'Word' | 'Excel' | 'PowerPoint'> = {
  word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint',
};
const ns = NS[host];
const otherNamespaces = Object.values(NS).filter(n => n !== ns);
```

Wrong-host detection becomes "code starts with any other namespace's `.run`":

```ts
for (const other of otherNamespaces) {
  if (trimmed.startsWith(`${other}.run`)) {
    return errorResult(
      `Code uses ${other}.run but the add-in is running in ${ns}. Rewrite using ${ns}.run.`
    );
  }
}
```

Same change mirrored in `iframe.html` (vanilla JS version). Wrap-detection (`startsWith(ns + '.run')`) and the wrap form (`return ${ns}.run(async function(context) { … })`) need no structural change beyond the namespace coming from the table.

The iframe sandbox is still not on the execute path today (sandbox runs in the parent window via `new Function`). We update `iframe.html` for symmetry / future-proofing but the runtime behavior change for this work lives entirely in `sandbox.ts`. If execution is ever routed through the iframe, the host continues to flow via the per-`execute` `postMessage` payload, not a one-time init — no race against `Office.onReady` inside the iframe.

## 4. Skill registry & PowerPoint skill list

Files reorganized into a third per-host folder:

```
src/taskpane/skills/
├── index.ts             ← already host-aware
├── word/                ← unchanged
├── excel/               ← unchanged
└── powerpoint/          ← new (14 files)
```

`index.ts` extends from a binary check to a per-host table, keeping the existing public signatures:

```ts
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

export function listSkills(host: HostKind): readonly string[];
export function lookupSkill(host: HostKind, name: string): string;
```

The orchestrator continues to read `listSkills(host)` for the system-prompt interpolation and the `lookup_skill` tool's input enum.

### PowerPoint skill set (14 files, full PowerPoint.run coverage)

| # | Skill | Covers |
|---|---|---|
| 1 | `context-sync` | `PowerPoint.run`, `load()` / `context.sync()`, batching reads vs writes, awaiting between sync and value access |
| 2 | `presentation` | top-level `context.presentation`: `title`, `slides`, `slideMasters`, `tags`, `getSelectedSlides`, `getSelectedShapes`, `getSelectedTextRange`, `insertSlidesFromBase64` |
| 3 | `slides` | iterate, `getItemAt`/`getItemOrNullObject`, add via `insertSlidesFromBase64`, `delete`, `moveTo`, `duplicate`, `id`, `layout`, `slideMaster`, `exportAsBase64` |
| 4 | `slide-layouts` | `SlideLayout`, `SlideMaster`, slide → layout → master chain, layout `name`/`id`, listing layouts under a master, applying a layout to a slide |
| 5 | `shapes` | iterating `slide.shapes`, `Shape.type` enum, `geometricShapeType`, `name`, `top`/`left`/`width`/`height`/`rotation`, `placeholder`, `parentSlide`, `delete`, common pitfalls (text vs geometric vs image vs table) |
| 6 | `text` | `shape.textFrame`, `textRange`, `paragraphs`, runs/segments, `font` (name/size/bold/italic/color/underline), bullet vs numbered, alignment, autoSize/wordWrap |
| 7 | `tables` | reading existing table shapes (`Shape.type === 'Table'` access patterns); inserting new tables via `insertSlidesFromBase64` OOXML round-trip — document the limitation explicitly |
| 8 | `images` | inserting images via base64, reading `Shape.image.getImageAsBase64`, sizing/positioning, replacing |
| 9 | `charts` | reading existing chart shapes (`Shape.type === 'Chart'`), interop with Excel-embedded charts on slides, what `PowerPoint.run` exposes vs what requires OOXML |
| 10 | `hyperlinks` | `shape.hyperlink`, `textRange.hyperlinks`, types (URL, slide jump), removing |
| 11 | `tags` | `presentation.tags`, `slide.tags`, `shape.tags`: `add`/`getItem`/`delete`, key-value persistence patterns and use cases |
| 12 | `selection` | `getSelectedSlides()`, `getSelectedShapes()`, `getSelectedTextRange()`, null/empty handling, "act on current selection" patterns |
| 13 | `notes` | speaker notes via `slide.notesPage` / notes shape access, reading and writing notes text, scope of what office.js exposes |
| 14 | `ooxml` | `presentation.insertSlidesFromBase64` with source/target formatting options, base64-packaging a single slide or a full deck, common round-trip patterns to work around gaps in the typed API (e.g. inserting tables/charts) |

Each file follows the existing Word/Excel skill template: short overview, key types, common patterns with code examples, common mistakes. The implementation plan treats each PowerPoint skill as its own checklist item.

## 5. Agent orchestrator & system prompt

`buildSystemPrompt(host, skills)` extends to a three-way switch:

```ts
const hostName = host === 'word' ? 'Microsoft Word'
               : host === 'excel' ? 'Microsoft Excel'
               : 'Microsoft PowerPoint';
const apiRoot  = host === 'word' ? 'Word'
               : host === 'excel' ? 'Excel'
               : 'PowerPoint';
```

The host-specific guidance line that today picks between Word's `InsertLocation` rule and Excel's "prefer typed APIs" rule gets a third branch for PowerPoint:

> `- Most edits go through shapes; many things (tables, complex charts) require OOXML round-trips via insertSlidesFromBase64`

`makeLookupSkillTool(host)` and the `execute_code` tool description already pull host-aware metadata; both auto-extend through the `HostKind` switch with no structural change beyond the new branch.

## 6. UI: host badge

`HostContext.displayName` is `'PowerPoint'` for the new host. The existing Fluent UI badge in the chat panel header renders it with no JSX change. Welcome text / chat placeholder copy that branches on host gets a PowerPoint branch alongside the existing Word/Excel branches (e.g. an example like *"add a slide titled 'Q3 Plan' with three bullets"*).

## 7. Settings, build, README

- **Settings:** zero schema change. One Add-in ID = one shared `roamingSettings` across all three hosts.
- **Build / Vite:** zero change. Same single-page app, same output.
- **README:**
  - Title line and tagline: "Word + Excel" → "Word + Excel + PowerPoint".
  - Comparison table: update product description; add a PowerPoint example to "Describe what you want — for Word / Excel / PowerPoint".
  - Architecture: same diagram; extend the "same task pane runs in Word and Excel" sentence to include PowerPoint.
  - Prerequisites: Microsoft 365 (Word, Excel, or PowerPoint — Web or Desktop).
  - Quick Start: add the new `start:powerpoint` / `sideload:powerpoint` scripts.
  - Note that settings are shared across all three hosts.

## 8. Risks, open questions, mitigations

| Risk | Mitigation |
|---|---|
| Multi-host manifest with three hosts rejected by older/on-prem Office builds | Plan-step runs `office-addin-manifest validate`; fall back to a two-manifest split sharing one task pane URL if validation fails. Do not preemptively split. |
| `PowerPoint.run` not actually present in the sandbox at runtime (older PowerPoint Web/Desktop builds) | Smoke-test step in the implementation plan: open AutoOffice in PowerPoint, run a trivial `PowerPoint.run` no-op, confirm output. Block on green smoke before declaring PowerPoint support working. |
| `PowerPoint.run` surface gaps (no native table insert, limited chart manipulation, no animations/transitions) | Skills explicitly call out the gap and steer the agent toward `insertSlidesFromBase64` OOXML round-trips where applicable. |
| Sandbox wrong-host check is no longer binary | Refactor to a namespace table + `Object.values(...).filter(...)` so adding a fourth host later is one map entry, not new branches. |
| 14 PowerPoint skills written in one pass risk shallowness | Each skill is its own checklist item in the implementation plan, modeled on the closest existing Word or Excel skill where applicable. |
| User expects per-host settings (different provider for PowerPoint vs Word/Excel) | Document explicitly in README that settings are shared by design. Out of scope. |

## 9. Implementation breakdown (rough sequencing — full plan TBD)

1. Extend `HostKind` to include `'powerpoint'`; add `Office.HostType.PowerPoint` branch in `detectHost`. Let the type checker surface every site needing a third branch and fix each:
   - `sandbox.ts` namespace-table refactor.
   - `iframe.html` namespace-table refactor.
   - `system-prompt.ts` three-way switch and PowerPoint-specific guidance line.
   - Any chat-panel copy that branches on host (welcome text, placeholder).
2. Skill registry: add `skills/powerpoint/` scaffold; extend `skills/index.ts` to per-host table. Verify Word + Excel still work end-to-end.
3. Manifest: add `Presentation` host blocks to both `manifest.xml` and `manifest.production.xml`; validate; add `start:powerpoint` / `sideload:powerpoint` npm scripts; smoke-test PowerPoint sideload with a no-op `PowerPoint.run`.
4. PowerPoint skills — 14 files, one per Section 4 table row. Each authored against the existing Word/Excel skill template.
5. Installer copy update (Word & Excel → Word, Excel & PowerPoint).
6. README + manifest/`package.json` description updates.
7. Final smoke test in all three hosts; ship.

The implementation plan from `writing-plans` will turn this into discrete, testable steps with verification gates.
