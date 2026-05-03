# Multi-Language Support — Design

**Date:** 2026-05-03
**Branch (planned):** `feat/multi-language`
**Supersedes/extends:** PR #4 (`YOSEFTT:master` — adds Hebrew + language setting)

## Problem

PR #4 wires up a working English/Hebrew toggle, but its design only scales to "two languages." The locale type is a hardcoded union, the locale list is duplicated across four files, RTL plumbing is hand-rolled, the `<html lang>` attribute can only be `'en'` or `'he'`, all translation dictionaries are imported eagerly, translation keys aren't type-checked, and the AI agent has no idea what language the user prefers — so the chat UI can be Hebrew while the agent still replies in English.

To make AutoOffice **really multilingual** — not just bilingual — we need an architecture where:

- Adding a language is a one-PR change (one row in a registry + one JSON file).
- The agent itself responds in the user's language.
- The bundle stays lean as we add locales (no eager-loading 20× translation files).
- Translators can contribute without touching TypeScript.
- Forgetting a translation key fails type-check / CI, not at runtime.

## Goals

1. **Adding a language = registry row + one JSON file.** No type-system edits, no `if/else` ladders, no per-language code paths.
2. **The product is multilingual, not just the chrome.** Agent prose, agent-surfaced errors, and dynamic strings respect the user's locale.
3. **Ship lean.** No 40 KB i18n framework. Use platform `Intl.*` APIs and a thin custom layer; lazy-load locale dictionaries.
4. **Type-safe keys.** Translation keys are a generated literal-union type; misspellings and missing keys fail at compile/CI.
5. **Translator-friendly.** Strings live in JSON files, ready for Crowdin/Lokalise/etc. without a code change.

## Non-goals

- Full ICU MessageFormat parser (defer until real strings need `{count, plural, one {…} other {…}}`).
- Translating skill markdown docs (`src/taskpane/skills/{word,excel,powerpoint}/*.md`) — they're API references consumed by the LLM; English is correct.
- Translating user document contents.
- Right-to-left bidirectional text injection inside generated office.js code.
- Telemetry on locale usage.

## What we keep from PR #4

| Element | Reason |
|---|---|
| Provider/Context/hooks shape (`LanguageProvider`, `useTranslation`, `useDirection`) | Idiomatic React; no reason to redo. |
| Detection cascade: saved → `Office.context.displayLanguage` → `navigator.language` → default | Correct behavior; just generalize the normalizer. |
| `'iw' → 'he'` legacy mapping | Real-world bug we'd otherwise re-discover. |
| `Office.context.roamingSettings` + `localStorage` persistence | Correct dual-storage strategy for Office add-ins. |
| ARIA live-region announcement on language change | Accessibility win; keep it. |
| Component integrations (`SettingsPanel`, `ChatPanel`, `CodeBlock`, `ToolActivity`, `MessageBubble`) | All the right files were touched; we keep the touch points. |
| English string corpus in `translations/en.ts` | Migrated to `locales/en.json` verbatim. |
| Tests under `src/taskpane/i18n/*.test.*` (~2 kLOC) | Adapted to new shape; behavior coverage retained. |

## What we drop from PR #4

| Element | Replacement |
|---|---|
| `Locale = 'en' \| 'he'` hardcoded union | `LocaleId = keyof typeof LOCALES` derived from registry |
| `Translations { en; he }` | `Record<LocaleId, TranslationDict>` |
| `isValidLocale` `if/else` ladder | `locale in LOCALES` |
| Hardcoded `<html lang>` to `'en'` or `'he'` | Set to actual `LocaleId` |
| `normalizeLanguageCode` per-language ladder | Generic walk: try full tag → strip subtag → registry lookup |
| Eager `import { en, he } from './translations'` | `import('./locales/${locale}.json')` (lazy, code-split) |
| Custom RTL hooks in `i18n/styles.ts` (107 lines) | `<FluentProvider dir>` + CSS logical properties |
| Unused `TranslationKeys` interface | Generated `TranslationKey` literal union |

## Architecture

```
src/taskpane/i18n/
├── registry.ts             single source of truth: LocaleId → metadata
├── types.ts                LocaleMeta, TranslationDict, TranslationParams
├── service.ts              TranslationService: t(), locale state, fallback chain
├── context.tsx             LanguageProvider, LanguageContext
├── hooks.ts                useTranslation, useDirection, useFormatters
├── detect.ts               detectLocale(): saved → Office → navigator → fallback
├── storage.ts              roamingSettings + localStorage persistence
├── loader.ts               lazy import() of translations[locale]; in-memory cache
├── format.ts               Intl-based date/number/list/relative-time/plural helpers
├── keys.generated.ts       (build output) TranslationKey literal union
└── locales/
    ├── en.json             canonical / source-of-truth strings
    ├── he.json
    └── (future: fr.json, es.json, ar.json, …)

tools/                      (build-time scripts, not bundled)
├── gen-i18n-types.ts       reads en.json → emits i18n/keys.generated.ts
└── check-translations.ts   CLI: verifies locale coverage; runs in CI
```

`types.ts` defines:

```ts
export interface LocaleMeta {
  name: string;          // English name, e.g. "Hebrew"
  nativeName: string;    // self-name, e.g. "עברית"
  direction: 'ltr' | 'rtl';
  fallback: string | null;   // a LocaleId, or null for the root (en)
}
export type TranslationDict = { [key: string]: string | TranslationDict };
export type TranslationParams = Record<string, string | number>;
```

## Locale registry — the single source of truth

```ts
// registry.ts
export const LOCALES = {
  en: { name: 'English', nativeName: 'English', direction: 'ltr', fallback: null },
  he: { name: 'Hebrew',  nativeName: 'עברית',   direction: 'rtl', fallback: 'en' },
  // Adding French is exactly this:
  // fr: { name: 'French', nativeName: 'Français', direction: 'ltr', fallback: 'en' },
} as const satisfies Record<string, LocaleMeta>;

export type LocaleId = keyof typeof LOCALES;
export const DEFAULT_LOCALE: LocaleId = 'en';

export function isLocaleId(s: string): s is LocaleId {
  return s in LOCALES;
}
```

Adding a language is: (a) one row in `LOCALES`, (b) one JSON file in `locales/`. No other files touched.

## Translation files — JSON

`locales/*.json` is the canonical format. JSON because:

- Translators don't touch TypeScript.
- Crowdin/Lokalise/POEditor pipelines can ingest without code changes.
- `tsc --resolveJsonModule` lets TS still see the shape.

`locales/en.json` is the **canonical** / source-of-truth. All other locales are checked against its key set.

## Type-safe keys

Build script `tools/gen-i18n-types.ts` (project root, not under `src/`):

1. Reads `locales/en.json`.
2. Walks all leaf keys (string values).
3. Emits `i18n/keys.generated.ts`:
   ```ts
   // Auto-generated — do not edit.
   export type TranslationKey =
     | 'common.appName'
     | 'settings.title'
     | 'chat.welcomeMessage'
     | …;
   ```
4. Wired into `package.json` as `prebuild` and into the test script.

`t()` is typed `(key: TranslationKey, params?: …) => string`. Misspelling or removing a key surfaces at every callsite.

## Lazy loading

```ts
// loader.ts
const cache = new Map<LocaleId, TranslationDict>();
export async function loadLocale(id: LocaleId): Promise<TranslationDict> {
  if (cache.has(id)) return cache.get(id)!;
  const mod = await import(`./locales/${id}.json`);
  cache.set(id, mod.default);
  return mod.default;
}
```

- `en` is preloaded at app bootstrap (it's the universal fallback).
- The detected locale (if non-`en`) is also preloaded **before first paint**, to avoid an English flash.
- Vite emits one chunk per `locales/*.json`; only the user's locale is downloaded.

## Fallback chain

`registry.fallback` chains locales toward `en`. The chain is followed when a key is missing in the active locale, ending at the bare key string as last resort. Adding regional variants later (e.g., a `pt-BR` registered with `fallback: 'pt'` and a `pt` registered with `fallback: 'en'`) is supported without code changes.

```
t('foo.bar')
  → currentLocale[foo.bar]
  → currentLocale.fallback[foo.bar]
  → … (transitive)
  → en[foo.bar]
  → 'foo.bar'   (last resort, only if no locale has it)
```

## Direction handling — use the platform

The PR's `i18n/styles.ts` (`useMarginInlineStart`, `useFlexRow`, etc.) is removed. Replaced by:

1. **Fluent UI v9 native RTL.** Wrap the app in `<FluentProvider dir={direction}>`; Fluent components mirror automatically.
2. **CSS logical properties** in any custom CSS — `margin-inline-start`, `padding-inline-end`, `inset-inline-start`. Browsers handle the LTR/RTL flip natively. Office add-in target browsers (Edge WebView2 / Safari / Chromium) all support these.
3. **`<html lang={locale} dir={direction}>`** — set to the actual `LocaleId`, not "he or en."

## Detection cascade (`detect.ts`)

Generalizing PR #4's logic:

```
detectLocale():
  1. Saved roamingSettings/localStorage value
       → if it's a current LocaleId, use it.
  2. Office.context.displayLanguage
       → normalize → first registry hit (full tag, then primary subtag).
  3. navigator.languages[]
       → for each: normalize → first registry hit.
  4. DEFAULT_LOCALE.
```

`normalize(tag)`:
- Lowercase, replace `_` with `-`.
- Map historical codes (`iw → he`, `in → id`, `ji → yi`).
- Try the full tag; on miss, strip the trailing subtag and retry. Repeat until empty.
- Return the first `LocaleId` found, or `null`.

## Formatters (`format.ts` + `useFormatters` hook)

```ts
const { formatDate, formatNumber, formatRelativeTime, formatList, formatPlural } = useFormatters();

formatDate(timestamp, 'short' | 'medium' | 'long');
formatRelativeTime(-2, 'minute');
formatList(['Alice','Bob','Carol']);
formatNumber(12345.67);
formatPlural(count, { zero?, one, two?, few?, many?, other });
```

All implemented as memoized `Intl.*` constructors keyed by the active locale. Plurals use `Intl.PluralRules`.

If full ICU MessageFormat (e.g., `{count, plural, …}`) becomes necessary, add `intl-messageformat` (~10 KB) without restructuring — `t()` would just delegate to it when params include a count.

## Multilingual agent

The "shallow vs deep multilingual" line. Three changes:

1. **System prompt augmentation.** `buildSystemPrompt(host, skills, locale)` accepts a locale and appends a localization clause:

   > Respond to the user in **{nativeName}** ({code}). Match the user's language for all explanations, status text, error descriptions, and code comments. Skill documentation provided to you is in English; translate concepts into {nativeName} when explaining to the user. Code identifiers (variable names, API names) stay in English.

2. **Locale threaded through `runAgent`.** `orchestrator.ts` already imports `translationService` (PR #4); we add `locale` to the `buildSystemPrompt` call and to any error message rendered into the chat.

3. **Locale-aware error surfacing.** Errors thrown out of the sandbox or AI SDK that are rendered into the chat are wrapped through `t('errors.executionFailed', { message })` (already prepared in PR #4 — apply consistently in `orchestrator.ts`).

The user's typed message is already in their language; LLMs follow the addressed language by default. The system-prompt clause reinforces it for short prompts and code-heavy turns.

## Persistence (`storage.ts`)

Keep PR #4's `roamingSettings` + `localStorage` strategy. The stored value is now a free-form `LocaleId` string validated via `isLocaleId(s)` on read. No migration needed when adding languages.

When a stored value is no longer in the registry (e.g., a locale was removed), fall through to detection.

## Settings UI

`SettingsPanel`'s language section stays. The dropdown is now data-driven from `Object.values(LOCALES)`; adding a locale to the registry automatically populates it. The selected option uses `nativeName` as the visible label and `name` as the `aria-description`.

## Translation completeness check (`tools/check-translations.ts`)

CLI: `npm run check:i18n`.

- Parse `locales/en.json`, build the canonical key set.
- For each other locale in the registry:
  - Verify the file exists.
  - Verify it parses.
  - Diff key sets: report **missing** and **extra** keys.
  - Optional: warn on values identical to English (likely untranslated), with a per-key whitelist for proper nouns ("AutoOffice").
- Exit non-zero on missing keys; warnings only on extras / probable-untranslated.
- CI step: GitHub Actions runs it on every PR. Failures block merge.
- Runtime is unaffected by gaps — fallback chain handles them.

## Rollout (three stages)

### Stage 1 — Refactor i18n core (no user-visible behavior change)

- Add `registry.ts`, switch types to `LocaleId`.
- Convert `translations/en.ts`, `translations/he.ts` → `locales/en.json`, `locales/he.json`.
- Add `loader.ts` (lazy `import()`).
- Add type-generation script + `keys.generated.ts`; wire into `prebuild` + `pretest`.
- Delete `i18n/styles.ts`. Wrap app in `<FluentProvider dir>`; convert any in-codebase usages of the deleted hooks to CSS logical properties or `dir="auto"` attributes.
- Set `<html lang>` to actual `LocaleId`.
- Adapt PR #4's tests to the new shape; preserve behavioral assertions.

### Stage 2 — Multilingual agent

- Add `locale: LocaleId` parameter to `buildSystemPrompt`; thread it through `runAgent` callsites.
- Append the localization clause to the system prompt.
- Wrap orchestrator-emitted error chat messages in `t()` consistently.
- Manual test matrix: switch UI to Hebrew → ask agent to "make headings blue" in Word → expect Hebrew explanation + (English-named) office.js code.

### Stage 3 — Translator workflow + CI

- `npm run check:i18n` script (runs `tools/check-translations.ts`).
- GitHub Actions step: add a `pull_request` job that runs `npm test` + `npm run check:i18n`. If no PR-CI workflow exists yet, create one (`.github/workflows/ci.yml`).
- README section: **Adding a language** — three-step recipe.
- *(Optional, separate PR)* Seed 1–2 additional locales (e.g. `fr`, `ar`) to prove scalability and exercise RTL+LTR matrix.

## Testing strategy

- **Adapt PR #4 tests** to the new registry-driven shape; preserve behavioral coverage of the provider, hooks, storage, detection.
- **Add registry contract tests** — every locale has metadata; every locale's JSON parses; every locale's keys are a (improper) subset of `en`'s.
- **Add agent-prompt snapshot test** — `buildSystemPrompt(..., 'en')` and `buildSystemPrompt(..., 'he')` snapshots, asserting the localization clause is present with the right `nativeName`.
- **Add jsdom integration test** — switch locale via `useTranslation().setLocale('he')`; assert `<html lang="he" dir="rtl">`, `t('common.appName')` returns the Hebrew value, Fluent provider received `dir="rtl"`.
- **Add lazy-loader test** — `loadLocale('he')` returns dict; second call returns from cache (no re-import).

## Risk register

| Risk | Mitigation |
|---|---|
| Lazy-loading flashes English while target locale loads | Bootstrap preloads `en` + the detected locale before first render; `<App>` only mounts after both resolve. |
| Translator delivers partial coverage | Fallback chain shows English; CI check reports missing keys but doesn't crash runtime. |
| Agent ignores "respond in X" instruction for short turns | Place the clause near the end of the system prompt (more salient); reinforce in the worked examples shown to the model. |
| Office sandbox blocks dynamic `import()` | Vite emits standard ES module imports; Office add-ins support them via WebView2. Verified at the start of Stage 1; if blocked, switch to a static `Record<LocaleId, () => Promise<TranslationDict>>` map — still code-split per file. |
| Fluent UI v9 RTL has component-level edge cases on chat bubble or code block | PR #4 already runs RTL through Fluent; we keep the chat-bubble + CodeBlock layout test snapshots and verify visually after the styles.ts removal. |
| `<FluentProvider dir>` swap re-mounts components and loses state | Verify with a smoke test: type a message, switch locale, confirm input value/scroll position behavior is acceptable. If it remounts unwantedly, switch direction at the `<html>` level only and let Fluent inherit. |
| Generated `keys.generated.ts` becomes stale (forgot to re-run codegen) | Run codegen as `prebuild` and `pretest`; CI runs `npm test` so a stale file would surface. |
