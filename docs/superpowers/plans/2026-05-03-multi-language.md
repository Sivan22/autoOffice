# Multi-Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a registry-driven i18n system that lets the AutoOffice add-in (UI + AI agent) be used in any language. Adding a new language is one row in a registry plus one JSON file. English (`en`) and Hebrew (`he`) ship in this PR.

**Architecture:** A small custom layer over the platform `Intl.*` APIs, modeled as: `registry → loader (lazy import) → service (t/format) → React context/hooks → component callsites`. Translation keys live in JSON; a build step generates a `TranslationKey` literal-union type for compile-time safety. RTL is handled by `<FluentProvider dir>` plus CSS logical properties — no hand-rolled style hooks. The agent's system prompt is augmented with the user's locale so the AI replies in the user's language too.

**Tech Stack:** TypeScript 6, React 19, Vitest 3 (jsdom), Fluent UI v9, `Intl.*` (DateTimeFormat / NumberFormat / RelativeTimeFormat / ListFormat / PluralRules), Vite 8 (dynamic `import()` code-splits per locale JSON).

**Branch (planned):** `feat/multi-language`

**Spec:** `docs/superpowers/specs/2026-05-03-multi-language-design.md`

---

## File map

**Created (i18n core):**
- `src/taskpane/i18n/types.ts` — `LocaleMeta`, `TranslationDict`, `TranslationParams`
- `src/taskpane/i18n/registry.ts` — `LOCALES`, `LocaleId`, `DEFAULT_LOCALE`, `isLocaleId`, `getLocaleMeta`, `availableLocales`
- `src/taskpane/i18n/loader.ts` — `loadLocale(id)`, `clearLoaderCache()` (test helper)
- `src/taskpane/i18n/service.ts` — `TranslationService` class + `translationService` singleton
- `src/taskpane/i18n/format.ts` — Intl-based formatters
- `src/taskpane/i18n/detect.ts` — `detectLocale()`, `normalizeLanguageTag()`
- `src/taskpane/i18n/storage.ts` — `loadStoredLocale()`, `saveStoredLocale()`
- `src/taskpane/i18n/context.tsx` — `LanguageProvider`, `LanguageContext`, `LanguageContextValue`
- `src/taskpane/i18n/hooks.ts` — `useTranslation`, `useDirection`, `useFormatters`
- `src/taskpane/i18n/index.ts` — public re-exports
- `src/taskpane/i18n/keys.generated.ts` — codegen output (committed)
- `src/taskpane/i18n/locales/en.json` — canonical strings
- `src/taskpane/i18n/locales/he.json` — Hebrew strings

**Created (build/CI tools, not bundled):**
- `tools/gen-i18n-types.ts` — reads `en.json`, emits `keys.generated.ts`
- `tools/check-translations.ts` — verifies coverage; CI script
- `.github/workflows/ci.yml` — PR job runs lint/build/test/check:i18n

**Modified:**
- `src/taskpane/index.tsx` — wrap in `LanguageProvider`, set `<FluentProvider dir>`
- `src/taskpane/App.tsx` — preload locales before mount
- `src/taskpane/components/ChatPanel.tsx` — replace hardcoded strings with `t()`
- `src/taskpane/components/CodeBlock.tsx` — replace hardcoded strings with `t()`
- `src/taskpane/components/ToolActivity.tsx` — replace hardcoded strings with `t()`
- `src/taskpane/components/SettingsPanel.tsx` — replace strings + add language section
- `src/taskpane/components/MessageBubble.tsx` — pass-through (no strings; verify RTL)
- `src/taskpane/agent/system-prompt.ts` — add `locale` parameter + localization clause
- `src/taskpane/agent/orchestrator.ts` — thread `locale` into `buildSystemPrompt`
- `package.json` — add `prebuild`, `pretest`, `check:i18n` scripts
- `index.html` — keep (we set `lang`/`dir` from React)
- `tsconfig.json` — already has `resolveJsonModule: true` (verified, no change)

---

## String inventory (from PR #4, used as our canonical `en.json`)

The structure below is the source of truth for `locales/en.json` referenced throughout the plan. Every task that mentions translations refers to this shape.

```json
{
  "common": {
    "appName": "AutoOffice",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "cancel": "Cancel",
    "save": "Save",
    "close": "Close"
  },
  "chat": {
    "welcomeTitle": "Welcome to AutoOffice",
    "welcomeMessage": "Ask me to do anything with your {{host}} document. I'll write and run office.js code to make it happen.",
    "exampleWord": "Try: \"Make all headings blue\" or \"Insert a 3-column table\"",
    "exampleExcel": "Try: \"Put 1 through 10 in column A\" or \"Make a chart from B2:D8\"",
    "examplePowerpoint": "Try: \"Add a slide titled 'Q3 plan' with three bullets\" or \"Make all slide titles bold\"",
    "inputPlaceholder": "Ask me to modify the {{host}}...",
    "sendButton": "Send",
    "settingsTooltip": "Settings",
    "historyTooltip": "History",
    "newChatTooltip": "New chat"
  },
  "settings": {
    "title": "Settings",
    "backButton": "Back",
    "providerSection": "AI Provider",
    "providerLabel": "Provider",
    "providerPlaceholder": "Select a provider...",
    "apiKeyLabel": "API Key",
    "apiKeyPlaceholder": "Enter API key...",
    "baseUrlLabel": "Base URL",
    "baseUrlPlaceholder": "http://localhost:11434/v1",
    "modelLabel": "Model",
    "modelPlaceholder": "Enter model name...",
    "executionSection": "Execution",
    "autoApproveLabel": "Auto-approve code execution",
    "maxRetriesLabel": "Max retry attempts",
    "timeoutLabel": "Execution timeout (seconds)",
    "mcpSection": "MCP Servers",
    "mcpAddButton": "Add",
    "mcpNoServers": "No MCP servers configured. Add one to extend the agent's capabilities.",
    "mcpNamePlaceholder": "Server name",
    "mcpUrlPlaceholder": "https://server-url/mcp",
    "languageSection": "Language",
    "languageLabel": "Interface Language",
    "languagePlaceholder": "Select a language...",
    "languageDescription": "Select your preferred interface language. The interface updates immediately."
  },
  "code": {
    "approveButton": "Approve & Run",
    "rejectButton": "Reject",
    "statusPending": "Awaiting Approval",
    "statusRejected": "Rejected",
    "statusRunning": "Running...",
    "statusSuccess": "Success",
    "statusError": "Error",
    "errorDetails": "Error details",
    "result": "Result",
    "toolActivity": "looked up: {{toolName}}"
  },
  "errors": {
    "executionFailed": "Code execution failed: {{message}}",
    "networkError": "Network error. Please check your connection.",
    "invalidApiKey": "Invalid API key. Please check your settings.",
    "timeout": "Request timed out. Please try again.",
    "unknownError": "An unknown error occurred.",
    "codeRejected": "User rejected the code. Ask what they would like changed.",
    "maxRetriesReached": "Failed after {{count}} attempts. Last error: {{error}}",
    "pleaseFixAndRetry": "Please fix and try again.",
    "streamError": "Error: {{message}}"
  },
  "fatal": {
    "cannotStart": "AutoOffice cannot start"
  }
}
```

The Hebrew translations come verbatim from PR #4's `he.ts` with the same shape; Task 4 spells out the JSON.

---

## Stage 1 — Foundation

### Task 1: Branch + types

**Files:**
- Create: `src/taskpane/i18n/types.ts`

- [ ] **Step 1: Create branch from current master**

```bash
git checkout master
git pull --ff-only
git checkout -b feat/multi-language
```

- [ ] **Step 2: Create `src/taskpane/i18n/types.ts`**

```ts
export interface LocaleMeta {
  /** English-language name, e.g. "Hebrew". */
  name: string;
  /** Self-name written in the locale itself, e.g. "עברית". */
  nativeName: string;
  /** Layout direction. */
  direction: 'ltr' | 'rtl';
  /** Locale id to fall back to for missing keys, or null for the root (en). */
  fallback: string | null;
}

/** Nested string dictionary loaded from a locale JSON file. */
export type TranslationDict = { [key: string]: string | TranslationDict };

/** Parameters interpolated into `{{name}}` placeholders inside a translation. */
export type TranslationParams = Record<string, string | number>;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no output, exit 0).

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/i18n/types.ts
git commit -m "i18n: add locale type definitions"
```

---

### Task 2: Locale registry

**Files:**
- Create: `src/taskpane/i18n/registry.ts`
- Test: `src/taskpane/i18n/registry.test.ts`

- [ ] **Step 1: Write failing test `src/taskpane/i18n/registry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  DEFAULT_LOCALE,
  isLocaleId,
  getLocaleMeta,
  availableLocales,
} from './registry.ts';

describe('registry', () => {
  it('exposes en and he locales with correct metadata', () => {
    expect(LOCALES.en.direction).toBe('ltr');
    expect(LOCALES.en.fallback).toBeNull();
    expect(LOCALES.en.nativeName).toBe('English');
    expect(LOCALES.he.direction).toBe('rtl');
    expect(LOCALES.he.fallback).toBe('en');
    expect(LOCALES.he.nativeName).toBe('עברית');
  });

  it('default locale is en', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('isLocaleId narrows valid ids', () => {
    expect(isLocaleId('en')).toBe(true);
    expect(isLocaleId('he')).toBe(true);
    expect(isLocaleId('xx')).toBe(false);
    expect(isLocaleId('')).toBe(false);
  });

  it('getLocaleMeta returns metadata for a known id', () => {
    expect(getLocaleMeta('he').direction).toBe('rtl');
  });

  it('availableLocales returns all registered locales as { id, ...meta } rows', () => {
    const list = availableLocales();
    expect(list.map(l => l.id).sort()).toEqual(['en', 'he']);
    expect(list.find(l => l.id === 'he')!.nativeName).toBe('עברית');
  });

  it('every fallback (when set) points at another registered locale', () => {
    for (const [id, meta] of Object.entries(LOCALES)) {
      if (meta.fallback !== null) {
        expect(meta.fallback in LOCALES, `${id}.fallback=${meta.fallback}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/taskpane/i18n/registry.test.ts`
Expected: FAIL — `Cannot find module './registry.ts'`.

- [ ] **Step 3: Create `src/taskpane/i18n/registry.ts`**

```ts
import type { LocaleMeta } from './types.ts';

export const LOCALES = {
  en: { name: 'English', nativeName: 'English', direction: 'ltr', fallback: null },
  he: { name: 'Hebrew',  nativeName: 'עברית',   direction: 'rtl', fallback: 'en' },
} as const satisfies Record<string, LocaleMeta>;

export type LocaleId = keyof typeof LOCALES;
export const DEFAULT_LOCALE: LocaleId = 'en';

export function isLocaleId(s: string): s is LocaleId {
  return Object.prototype.hasOwnProperty.call(LOCALES, s);
}

export function getLocaleMeta(id: LocaleId): LocaleMeta {
  return LOCALES[id];
}

export function availableLocales(): Array<{ id: LocaleId } & LocaleMeta> {
  return (Object.keys(LOCALES) as LocaleId[]).map(id => ({ id, ...LOCALES[id] }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/taskpane/i18n/registry.test.ts`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/i18n/registry.ts src/taskpane/i18n/registry.test.ts
git commit -m "i18n: add locale registry with isLocaleId/availableLocales"
```

---

### Task 3: Canonical English JSON

**Files:**
- Create: `src/taskpane/i18n/locales/en.json`

- [ ] **Step 1: Create directory and file**

```bash
mkdir -p src/taskpane/i18n/locales
```

Then create `src/taskpane/i18n/locales/en.json` with the exact contents shown in the **String inventory** section at the top of this plan.

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/taskpane/i18n/locales/en.json','utf8'))"`
Expected: exit 0, no output.

- [ ] **Step 3: Verify TypeScript can import the JSON (resolveJsonModule is on)**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/i18n/locales/en.json
git commit -m "i18n: add canonical English translation strings"
```

---

### Task 4: Hebrew JSON

**Files:**
- Create: `src/taskpane/i18n/locales/he.json`

- [ ] **Step 1: Create `src/taskpane/i18n/locales/he.json`**

```json
{
  "common": {
    "appName": "AutoOffice",
    "loading": "טוען...",
    "error": "שגיאה",
    "success": "הצלחה",
    "cancel": "ביטול",
    "save": "שמירה",
    "close": "סגירה"
  },
  "chat": {
    "welcomeTitle": "ברוכים הבאים ל-AutoOffice",
    "welcomeMessage": "בקש ממני לעשות כל דבר עם מסמך ה-{{host}} שלך. אני אכתוב ואריץ קוד office.js כדי לבצע את זה.",
    "exampleWord": "נסה: \"צבע את כל הכותרות בכחול\" או \"הוסף טבלה בת 3 עמודות\"",
    "exampleExcel": "נסה: \"שים את המספרים 1 עד 10 בעמודה A\" או \"צור גרף מ-B2:D8\"",
    "examplePowerpoint": "נסה: \"הוסף שקופית בכותרת 'תוכנית רבעון 3' עם שלוש נקודות\" או \"הפוך את כל כותרות השקופיות למודגשות\"",
    "inputPlaceholder": "בקש ממני לשנות את ה-{{host}}...",
    "sendButton": "שלח",
    "settingsTooltip": "הגדרות",
    "historyTooltip": "היסטוריה",
    "newChatTooltip": "צ'אט חדש"
  },
  "settings": {
    "title": "הגדרות",
    "backButton": "חזרה",
    "providerSection": "ספק AI",
    "providerLabel": "ספק",
    "providerPlaceholder": "בחר ספק...",
    "apiKeyLabel": "מפתח API",
    "apiKeyPlaceholder": "הזן מפתח API...",
    "baseUrlLabel": "כתובת בסיס",
    "baseUrlPlaceholder": "http://localhost:11434/v1",
    "modelLabel": "מודל",
    "modelPlaceholder": "הזן שם מודל...",
    "executionSection": "הרצה",
    "autoApproveLabel": "אישור אוטומטי להרצת קוד",
    "maxRetriesLabel": "מספר ניסיונות מקסימלי",
    "timeoutLabel": "זמן קצוב להרצה (שניות)",
    "mcpSection": "שרתי MCP",
    "mcpAddButton": "הוסף",
    "mcpNoServers": "לא הוגדרו שרתי MCP. הוסף אחד כדי להרחיב את יכולות הסוכן.",
    "mcpNamePlaceholder": "שם שרת",
    "mcpUrlPlaceholder": "https://server-url/mcp",
    "languageSection": "שפה",
    "languageLabel": "שפת ממשק",
    "languagePlaceholder": "בחר שפה...",
    "languageDescription": "בחר את שפת הממשק המועדפת עליך. הממשק יתעדכן מיד ללא טעינה מחדש."
  },
  "code": {
    "approveButton": "אשר והרץ",
    "rejectButton": "דחה",
    "statusPending": "ממתין לאישור",
    "statusRejected": "נדחה",
    "statusRunning": "רץ...",
    "statusSuccess": "הצלחה",
    "statusError": "שגיאה",
    "errorDetails": "פרטי שגיאה",
    "result": "תוצאה",
    "toolActivity": "חיפש: {{toolName}}"
  },
  "errors": {
    "executionFailed": "הרצת הקוד נכשלה: {{message}}",
    "networkError": "שגיאת רשת. אנא בדוק את החיבור שלך.",
    "invalidApiKey": "מפתח API לא תקין. אנא בדוק את ההגדרות שלך.",
    "timeout": "הבקשה פגה. אנא נסה שוב.",
    "unknownError": "אירעה שגיאה לא ידועה.",
    "codeRejected": "המשתמש דחה את הקוד. שאל מה הוא רוצה לשנות.",
    "maxRetriesReached": "נכשל אחרי {{count}} ניסיונות. שגיאה אחרונה: {{error}}",
    "pleaseFixAndRetry": "אנא תקן ונסה שוב.",
    "streamError": "שגיאה: {{message}}"
  },
  "fatal": {
    "cannotStart": "AutoOffice לא יכול להיפתח"
  }
}
```

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/taskpane/i18n/locales/he.json','utf8'))"`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/i18n/locales/he.json
git commit -m "i18n: add Hebrew translation strings"
```

---

### Task 5: Type-codegen script

**Files:**
- Create: `tools/gen-i18n-types.ts`
- Create: `src/taskpane/i18n/keys.generated.ts` (output, committed)
- Modify: `package.json`

- [ ] **Step 1: Create `tools/gen-i18n-types.ts`**

```ts
#!/usr/bin/env -S node --experimental-strip-types
// Reads src/taskpane/i18n/locales/en.json and writes
// src/taskpane/i18n/keys.generated.ts containing a TranslationKey
// literal-union type covering every leaf key.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve('src/taskpane/i18n/locales/en.json');
const OUT = resolve('src/taskpane/i18n/keys.generated.ts');

function flatten(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(path);
    else out.push(...flatten(v, path));
  }
  return out;
}

const json = JSON.parse(readFileSync(SRC, 'utf8'));
const keys = flatten(json).sort();

const body =
  '// AUTO-GENERATED by tools/gen-i18n-types.ts — do not edit by hand.\n' +
  '// Run `npm run gen:i18n` to regenerate.\n\n' +
  'export type TranslationKey =\n' +
  keys.map(k => `  | ${JSON.stringify(k)}`).join('\n') +
  ';\n';

writeFileSync(OUT, body);
console.log(`Wrote ${keys.length} keys to ${OUT}`);
```

- [ ] **Step 2: Add npm scripts to `package.json`**

Insert these into the `"scripts"` block (preserve existing scripts):

```json
"gen:i18n": "node --experimental-strip-types tools/gen-i18n-types.ts",
"prebuild": "npm run gen:i18n",
"pretest": "npm run gen:i18n"
```

- [ ] **Step 3: Run codegen**

Run: `npm run gen:i18n`
Expected: prints `Wrote N keys to .../keys.generated.ts`. File exists.

- [ ] **Step 4: Verify generated file compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/gen-i18n-types.ts src/taskpane/i18n/keys.generated.ts package.json
git commit -m "i18n: add type-codegen for translation keys"
```

---

### Task 6: Lazy loader

**Files:**
- Create: `src/taskpane/i18n/loader.ts`
- Test: `src/taskpane/i18n/loader.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/taskpane/i18n/loader.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadLocale, clearLoaderCache } from './loader.ts';

describe('loader', () => {
  beforeEach(() => clearLoaderCache());

  it('loads en.json and returns a parsed dict', async () => {
    const dict = await loadLocale('en');
    expect((dict as any).common.appName).toBe('AutoOffice');
  });

  it('loads he.json and returns Hebrew strings', async () => {
    const dict = await loadLocale('he');
    expect((dict as any).common.cancel).toBe('ביטול');
  });

  it('returns the same object reference on repeated calls (cache)', async () => {
    const a = await loadLocale('en');
    const b = await loadLocale('en');
    expect(a).toBe(b);
  });

  it('clearLoaderCache forces a re-import', async () => {
    const a = await loadLocale('en');
    clearLoaderCache();
    const b = await loadLocale('en');
    // structural equality but different object references after cache clear
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/taskpane/i18n/loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/taskpane/i18n/loader.ts`**

```ts
import type { LocaleId } from './registry.ts';
import type { TranslationDict } from './types.ts';

const cache = new Map<LocaleId, TranslationDict>();

export async function loadLocale(id: LocaleId): Promise<TranslationDict> {
  const cached = cache.get(id);
  if (cached) return cached;
  const mod = await import(`./locales/${id}.json`);
  const dict = (mod.default ?? mod) as TranslationDict;
  cache.set(id, dict);
  return dict;
}

/** Test helper. Not exported from `i18n/index.ts`. */
export function clearLoaderCache(): void {
  cache.clear();
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/taskpane/i18n/loader.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/i18n/loader.ts src/taskpane/i18n/loader.test.ts
git commit -m "i18n: add lazy locale loader with in-memory cache"
```

---

### Task 7: Translation service

**Files:**
- Create: `src/taskpane/i18n/service.ts`
- Test: `src/taskpane/i18n/service.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/taskpane/i18n/service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationService } from './service.ts';
import { clearLoaderCache } from './loader.ts';

describe('TranslationService', () => {
  beforeEach(() => clearLoaderCache());

  it('returns the key itself before any locale is loaded', () => {
    const svc = new TranslationService();
    expect(svc.t('common.appName')).toBe('common.appName');
  });

  it('returns the active locale string after preload', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    expect(svc.t('common.appName')).toBe('AutoOffice');
    expect(svc.getLocale()).toBe('en');
  });

  it('switches locales and reflects new strings', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    await svc.setLocale('he');
    expect(svc.t('common.cancel')).toBe('ביטול');
    expect(svc.getLocale()).toBe('he');
  });

  it('falls back through the chain to en when a key is missing in the active locale', async () => {
    const svc = new TranslationService();
    await svc.setLocale('he');
    // Inject a synthetic missing key by stubbing the active dict.
    (svc as any).active = { ...((svc as any).active), common: { appName: 'AutoOffice' } };
    // 'common.cancel' no longer exists in stubbed he dict; falls back to en.
    expect(svc.t('common.cancel')).toBe('Cancel');
  });

  it('returns the key string when no locale (incl. en fallback) has it', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    expect(svc.t('does.not.exist' as any)).toBe('does.not.exist');
  });

  it('interpolates {{name}} placeholders from params', async () => {
    const svc = new TranslationService();
    await svc.setLocale('en');
    expect(svc.t('chat.welcomeMessage', { host: 'Word' })).toContain('Word');
    expect(svc.t('code.toolActivity', { toolName: 'lookup_skill' }))
      .toBe('looked up: lookup_skill');
  });

  it('subscribes/unsubscribes to locale changes', async () => {
    const svc = new TranslationService();
    let calls = 0;
    const off = svc.subscribe(() => { calls++; });
    await svc.setLocale('en');
    await svc.setLocale('he');
    off();
    await svc.setLocale('en');
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/taskpane/i18n/service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/taskpane/i18n/service.ts`**

```ts
import type { TranslationDict, TranslationParams } from './types.ts';
import { DEFAULT_LOCALE, LOCALES, isLocaleId, type LocaleId } from './registry.ts';
import { loadLocale } from './loader.ts';
import type { TranslationKey } from './keys.generated.ts';

type Listener = (locale: LocaleId) => void;

function getNested(dict: TranslationDict | undefined, path: string): string | undefined {
  if (!dict) return undefined;
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : m,
  );
}

export class TranslationService {
  private locale: LocaleId = DEFAULT_LOCALE;
  private active: TranslationDict | undefined;
  private dicts = new Map<LocaleId, TranslationDict>();
  private listeners = new Set<Listener>();

  getLocale(): LocaleId {
    return this.locale;
  }

  /**
   * Load `id` (and its fallback chain) into memory and make it active.
   * Safe to call repeatedly; cached after first load.
   */
  async setLocale(id: LocaleId): Promise<void> {
    if (!isLocaleId(id)) throw new Error(`Unknown locale: ${id}`);

    // Walk fallback chain so missing keys can resolve synchronously in t().
    const chain: LocaleId[] = [];
    let cursor: LocaleId | null = id;
    while (cursor !== null) {
      chain.push(cursor);
      cursor = LOCALES[cursor].fallback as LocaleId | null;
    }
    await Promise.all(
      chain.map(async c => {
        if (!this.dicts.has(c)) this.dicts.set(c, await loadLocale(c));
      }),
    );

    this.locale = id;
    this.active = this.dicts.get(id);
    for (const l of this.listeners) l(id);
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    let cursor: LocaleId | null = this.locale;
    while (cursor !== null) {
      const dict = cursor === this.locale ? this.active : this.dicts.get(cursor);
      const hit = getNested(dict, key);
      if (hit !== undefined) return interpolate(hit, params);
      cursor = LOCALES[cursor].fallback as LocaleId | null;
    }
    return key;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const translationService = new TranslationService();
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/taskpane/i18n/service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/i18n/service.ts src/taskpane/i18n/service.test.ts
git commit -m "i18n: add TranslationService with fallback chain and interpolation"
```

---

### Task 8: Intl-based formatters

**Files:**
- Create: `src/taskpane/i18n/format.ts`
- Test: `src/taskpane/i18n/format.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/taskpane/i18n/format.test.ts
import { describe, it, expect } from 'vitest';
import { makeFormatters } from './format.ts';

describe('formatters', () => {
  it('formatDate returns a non-empty locale-specific string', () => {
    const en = makeFormatters('en');
    const he = makeFormatters('he');
    const ts = Date.UTC(2026, 0, 15);
    expect(en.formatDate(ts, 'short')).toMatch(/\d/);
    expect(he.formatDate(ts, 'short')).toMatch(/\d/);
  });

  it('formatNumber uses locale-appropriate separators', () => {
    const en = makeFormatters('en');
    expect(en.formatNumber(1234.5)).toBe('1,234.5');
  });

  it('formatRelativeTime returns a string', () => {
    const en = makeFormatters('en');
    expect(en.formatRelativeTime(-2, 'minute')).toMatch(/2/);
  });

  it('formatList joins items with locale-appropriate conjunction', () => {
    const en = makeFormatters('en');
    expect(en.formatList(['A', 'B', 'C'])).toBe('A, B, and C');
  });

  it('formatPlural picks the matching branch by Intl.PluralRules', () => {
    const en = makeFormatters('en');
    expect(en.formatPlural(1, { one: '{{n}} file', other: '{{n}} files' }))
      .toBe('1 file');
    expect(en.formatPlural(2, { one: '{{n}} file', other: '{{n}} files' }))
      .toBe('2 files');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/taskpane/i18n/format.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/taskpane/i18n/format.ts`**

```ts
import type { LocaleId } from './registry.ts';

export type DateStyle = 'short' | 'medium' | 'long';

export interface PluralBranches {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface Formatters {
  formatDate(value: Date | number, style?: DateStyle): string;
  formatNumber(value: number, opts?: Intl.NumberFormatOptions): string;
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  formatList(items: string[]): string;
  formatPlural(count: number, branches: PluralBranches): string;
}

export function makeFormatters(locale: LocaleId): Formatters {
  const dateShort = new Intl.DateTimeFormat(locale, { dateStyle: 'short' });
  const dateMedium = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const dateLong = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const number = new Intl.NumberFormat(locale);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  const plural = new Intl.PluralRules(locale);

  return {
    formatDate(value, style = 'short') {
      const f = style === 'long' ? dateLong : style === 'medium' ? dateMedium : dateShort;
      return f.format(typeof value === 'number' ? new Date(value) : value);
    },
    formatNumber(value, opts) {
      return opts ? new Intl.NumberFormat(locale, opts).format(value) : number.format(value);
    },
    formatRelativeTime(value, unit) {
      return relative.format(value, unit);
    },
    formatList(items) {
      return list.format(items);
    },
    formatPlural(count, branches) {
      const cat = plural.select(count) as keyof PluralBranches;
      const tpl = branches[cat] ?? branches.other;
      return tpl.replace(/\{\{n\}\}/g, String(count));
    },
  };
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/taskpane/i18n/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/i18n/format.ts src/taskpane/i18n/format.test.ts
git commit -m "i18n: add Intl-based formatters (date/number/list/relative/plural)"
```

---

### Task 9: Detection cascade

**Files:**
- Create: `src/taskpane/i18n/detect.ts`
- Test: `src/taskpane/i18n/detect.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/taskpane/i18n/detect.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectLocale, normalizeLanguageTag } from './detect.ts';

describe('normalizeLanguageTag', () => {
  it('resolves exact matches', () => {
    expect(normalizeLanguageTag('en')).toBe('en');
    expect(normalizeLanguageTag('he')).toBe('he');
  });

  it('lowercases and dashifies', () => {
    expect(normalizeLanguageTag('EN_US')).toBe('en');
    expect(normalizeLanguageTag('HE-IL')).toBe('he');
  });

  it('strips trailing subtags until a registry hit', () => {
    expect(normalizeLanguageTag('en-GB')).toBe('en');
    expect(normalizeLanguageTag('he-Hebr-IL')).toBe('he');
  });

  it('maps historical codes', () => {
    expect(normalizeLanguageTag('iw')).toBe('he');
    expect(normalizeLanguageTag('iw-IL')).toBe('he');
  });

  it('returns null for unsupported tags', () => {
    expect(normalizeLanguageTag('zz')).toBeNull();
    expect(normalizeLanguageTag('')).toBeNull();
  });
});

describe('detectLocale', () => {
  beforeEach(() => {
    // Each test stubs what it needs; default is "no Office, no preference".
    vi.unstubAllGlobals();
  });

  it('prefers a saved locale that is still in the registry', () => {
    expect(detectLocale({ saved: 'he' })).toBe('he');
  });

  it('ignores a saved locale that is no longer registered', () => {
    expect(detectLocale({ saved: 'xx' as any })).toBe('en');
  });

  it('uses Office.context.displayLanguage when no saved value', () => {
    vi.stubGlobal('Office', { context: { displayLanguage: 'he-IL' } });
    expect(detectLocale({})).toBe('he');
  });

  it('falls back to navigator.languages', () => {
    vi.stubGlobal('Office', undefined);
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'he-IL', 'en-US'] });
    expect(detectLocale({})).toBe('he'); // first registry hit wins
  });

  it('falls back to DEFAULT_LOCALE', () => {
    vi.stubGlobal('Office', undefined);
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    expect(detectLocale({})).toBe('en');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/taskpane/i18n/detect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/taskpane/i18n/detect.ts`**

```ts
import { DEFAULT_LOCALE, LOCALES, isLocaleId, type LocaleId } from './registry.ts';

const HISTORICAL: Record<string, string> = { iw: 'he', in: 'id', ji: 'yi' };

/**
 * Lower-case, dash-normalize, then walk down subtags until a registered
 * locale matches. Returns null if nothing matches.
 */
export function normalizeLanguageTag(tag: string): LocaleId | null {
  if (!tag) return null;
  let t = tag.toLowerCase().replace(/_/g, '-');
  const head = t.split('-')[0];
  if (head in HISTORICAL) t = HISTORICAL[head] + t.slice(head.length);
  while (t.length > 0) {
    if (isLocaleId(t)) return t;
    const i = t.lastIndexOf('-');
    if (i === -1) break;
    t = t.slice(0, i);
  }
  return null;
}

export interface DetectInput {
  saved?: string | null;
}

export function detectLocale({ saved }: DetectInput): LocaleId {
  if (saved && isLocaleId(saved)) return saved;

  try {
    const off = (globalThis as any).Office;
    const display = off?.context?.displayLanguage;
    if (typeof display === 'string') {
      const hit = normalizeLanguageTag(display);
      if (hit) return hit;
    }
  } catch { /* fall through */ }

  try {
    const nav = (globalThis as any).navigator;
    const langs: string[] = nav?.languages ?? (nav?.language ? [nav.language] : []);
    for (const l of langs) {
      const hit = normalizeLanguageTag(l);
      if (hit) return hit;
    }
  } catch { /* fall through */ }

  return DEFAULT_LOCALE;
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/taskpane/i18n/detect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/i18n/detect.ts src/taskpane/i18n/detect.test.ts
git commit -m "i18n: add locale detection cascade (saved → Office → navigator)"
```

---

### Task 10: Persistent storage

**Files:**
- Create: `src/taskpane/i18n/storage.ts`
- Test: `src/taskpane/i18n/storage.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/taskpane/i18n/storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadStoredLocale, saveStoredLocale, STORAGE_KEY } from './storage.ts';

describe('storage (localStorage path)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadStoredLocale()).toBeNull();
  });

  it('roundtrips a registered locale', () => {
    saveStoredLocale('he');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('he');
    expect(loadStoredLocale()).toBe('he');
  });

  it('returns null for stored values not in the registry', () => {
    localStorage.setItem(STORAGE_KEY, 'xx');
    expect(loadStoredLocale()).toBeNull();
  });

  it('uses Office.context.roamingSettings when present', () => {
    const store = new Map<string, string>();
    const roaming = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => { store.set(k, v); },
      saveAsync: () => {},
    };
    vi.stubGlobal('Office', { context: { roamingSettings: roaming } });
    saveStoredLocale('he');
    expect(store.get(STORAGE_KEY)).toBe('he');
    expect(loadStoredLocale()).toBe('he');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/taskpane/i18n/storage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/taskpane/i18n/storage.ts`**

```ts
import { isLocaleId, type LocaleId } from './registry.ts';

export const STORAGE_KEY = 'autooffice_language';

function roaming(): {
  get(k: string): string | null;
  set(k: string, v: string): void;
  saveAsync?: () => void;
} | null {
  try {
    const off = (globalThis as any).Office;
    const r = off?.context?.roamingSettings;
    if (r && typeof r.get === 'function' && typeof r.set === 'function') return r;
  } catch { /* ignore */ }
  return null;
}

export function loadStoredLocale(): LocaleId | null {
  try {
    const r = roaming();
    const raw = r ? r.get(STORAGE_KEY) : localStorage.getItem(STORAGE_KEY);
    if (typeof raw === 'string' && isLocaleId(raw)) return raw;
  } catch { /* ignore */ }
  return null;
}

export function saveStoredLocale(id: LocaleId): void {
  try {
    const r = roaming();
    if (r) {
      r.set(STORAGE_KEY, id);
      r.saveAsync?.();
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch { /* silent: best-effort persistence */ }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `npx vitest run src/taskpane/i18n/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/i18n/storage.ts src/taskpane/i18n/storage.test.ts
git commit -m "i18n: persist locale via roamingSettings or localStorage"
```

---

### Task 11: React provider, hooks, public index

**Files:**
- Create: `src/taskpane/i18n/context.tsx`
- Create: `src/taskpane/i18n/hooks.ts`
- Create: `src/taskpane/i18n/index.ts`
- Test: `src/taskpane/i18n/context.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// src/taskpane/i18n/context.test.tsx
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LanguageProvider } from './context.tsx';
import { useTranslation, useDirection } from './hooks.ts';

function Probe() {
  const { t, locale, setLocale } = useTranslation();
  const dir = useDirection();
  return (
    <div>
      <span data-testid="text">{t('common.appName')}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <button onClick={() => setLocale('he')} data-testid="switch">switch</button>
    </div>
  );
}

describe('LanguageProvider + hooks', () => {
  it('renders English by default and exposes ltr direction', async () => {
    await act(async () => {
      render(
        <LanguageProvider initialLocale="en">
          <Probe />
        </LanguageProvider>,
      );
    });
    expect(screen.getByTestId('text').textContent).toBe('AutoOffice');
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('dir').textContent).toBe('ltr');
  });

  it('switches to Hebrew, updates direction, and updates <html lang>/<dir>', async () => {
    await act(async () => {
      render(
        <LanguageProvider initialLocale="en">
          <Probe />
        </LanguageProvider>,
      );
    });
    await act(async () => {
      screen.getByTestId('switch').click();
    });
    expect(screen.getByTestId('locale').textContent).toBe('he');
    expect(screen.getByTestId('dir').textContent).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('he');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `npx vitest run src/taskpane/i18n/context.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Create `src/taskpane/i18n/context.tsx`**

```tsx
import React, {
  createContext, useCallback, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { translationService } from './service.ts';
import { detectLocale } from './detect.ts';
import { loadStoredLocale, saveStoredLocale } from './storage.ts';
import { LOCALES, type LocaleId } from './registry.ts';
import type { TranslationKey } from './keys.generated.ts';
import type { TranslationParams } from './types.ts';
import { makeFormatters, type Formatters } from './format.ts';

export interface LanguageContextValue {
  locale: LocaleId;
  direction: 'ltr' | 'rtl';
  t: (key: TranslationKey, params?: TranslationParams) => string;
  setLocale: (id: LocaleId) => Promise<void>;
  formatters: Formatters;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export interface LanguageProviderProps {
  children: ReactNode;
  /** When provided, skips detection and storage on mount. */
  initialLocale?: LocaleId;
}

export function LanguageProvider({ children, initialLocale }: LanguageProviderProps) {
  const seed = initialLocale ?? detectLocale({ saved: loadStoredLocale() });
  const [locale, setLocaleState] = useState<LocaleId>(seed);
  const [, force] = useState(0);

  // Initial load. setLocale is idempotent + cached so re-runs are cheap.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await translationService.setLocale(seed);
      if (!cancelled) force(n => n + 1);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply <html lang>/<dir> whenever locale changes.
  useEffect(() => {
    const meta = LOCALES[locale];
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', meta.direction);
  }, [locale]);

  const setLocale = useCallback(async (id: LocaleId) => {
    await translationService.setLocale(id);
    saveStoredLocale(id);
    setLocaleState(id);
    announce(id);
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    direction: LOCALES[locale].direction,
    t: (k, p) => translationService.t(k, p),
    setLocale,
    formatters: makeFormatters(locale),
  }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function announce(locale: LocaleId): void {
  const node = document.createElement('div');
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.style.cssText =
    'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
  node.textContent = `Language: ${LOCALES[locale].nativeName}`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1000);
}
```

- [ ] **Step 4: Create `src/taskpane/i18n/hooks.ts`**

```ts
import { useContext } from 'react';
import { LanguageContext, type LanguageContextValue } from './context.tsx';

function ctx(): LanguageContextValue {
  const c = useContext(LanguageContext);
  if (!c) throw new Error('LanguageProvider missing in tree');
  return c;
}

export function useTranslation() {
  const c = ctx();
  return { t: c.t, locale: c.locale, setLocale: c.setLocale };
}

export function useDirection(): 'ltr' | 'rtl' {
  return ctx().direction;
}

export function useFormatters() {
  return ctx().formatters;
}
```

- [ ] **Step 5: Create `src/taskpane/i18n/index.ts`**

```ts
export { LanguageProvider, LanguageContext, type LanguageContextValue } from './context.tsx';
export { useTranslation, useDirection, useFormatters } from './hooks.ts';
export {
  LOCALES, DEFAULT_LOCALE, isLocaleId, getLocaleMeta, availableLocales,
  type LocaleId,
} from './registry.ts';
export type { LocaleMeta, TranslationDict, TranslationParams } from './types.ts';
export type { TranslationKey } from './keys.generated.ts';
export { translationService } from './service.ts';
```

- [ ] **Step 6: Run test, expect PASS**

Run: `npx vitest run src/taskpane/i18n/context.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/taskpane/i18n/context.tsx src/taskpane/i18n/hooks.ts src/taskpane/i18n/index.ts src/taskpane/i18n/context.test.tsx
git commit -m "i18n: add React provider, hooks, and public index"
```

---

### Task 12: Mount provider; thread `dir` into FluentProvider

**Files:**
- Modify: `src/taskpane/index.tsx`

- [ ] **Step 1: Replace contents of `src/taskpane/index.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme, Text } from '@fluentui/react-components';
import { App } from './App.tsx';
import { detectHost, UnsupportedHostError, type HostContext } from './host/context.ts';
import { LanguageProvider, useDirection, useTranslation } from './i18n/index.ts';

function Shell({ children }: { children: React.ReactNode }) {
  const dir = useDirection();
  return (
    <FluentProvider theme={webLightTheme} dir={dir}>
      {children}
    </FluentProvider>
  );
}

function FatalShell({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <Shell>
      <div style={{ padding: '24px' }}>
        <Text size={400} weight="semibold">{t('fatal.cannotStart')}</Text>
        <p>{message}</p>
      </div>
    </Shell>
  );
}

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

function renderApp(host: HostContext) {
  root.render(
    <LanguageProvider>
      <Shell>
        <App host={host} />
      </Shell>
    </LanguageProvider>,
  );
}

function renderFatal(message: string) {
  root.render(
    <LanguageProvider>
      <FatalShell message={message} />
    </LanguageProvider>,
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

- [ ] **Step 2: Build and run unit tests**

Run: `npm run build && npm test`
Expected: build succeeds; existing tests still pass; new i18n tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/index.tsx
git commit -m "i18n: mount LanguageProvider; thread direction into FluentProvider"
```

---

### Task 13: Migrate `ChatPanel` strings

**Files:**
- Modify: `src/taskpane/components/ChatPanel.tsx`

- [ ] **Step 1: Find every hardcoded English literal**

Run: `grep -nE "'[A-Z][^']*'|\"[A-Z][^\"]*\"" src/taskpane/components/ChatPanel.tsx`
Expected: lines around `Welcome to AutoOffice`, `Try: ...` examples, the `Settings`/`History`/`New chat` tooltip strings, the input `placeholder`, and the `Send` button label/aria.

- [ ] **Step 2: Replace each literal with `t(...)` calls**

At the top of the component file, add:

```tsx
import { useTranslation } from '../i18n/index.ts';
```

Inside the component body, add `const { t } = useTranslation();`. Then replace strings as follows (refer to `String inventory` for keys):

- `"Welcome to AutoOffice"` → `t('chat.welcomeTitle')`
- The example string ternary block → `t('chat.exampleWord')` / `t('chat.exampleExcel')` / `t('chat.examplePowerpoint')` based on `host`.
- `"Settings"` (Tooltip content) → `t('chat.settingsTooltip')`
- `"History"` (Tooltip content) → `t('chat.historyTooltip')`
- `"New chat"` (Tooltip content) → `t('chat.newChatTooltip')`
- The `Textarea` placeholder string → `t('chat.inputPlaceholder', { host: hostLabel })` where `hostLabel` is the existing host display string (e.g. "Word"/"Excel"/"PowerPoint").
- The `Send` button label/aria-label → `t('chat.sendButton')`

If a `welcomeMessage` line exists in current code, also replace it with `t('chat.welcomeMessage', { host: hostLabel })`.

- [ ] **Step 3: Build to confirm types are valid**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run dev server, switch language, verify**

Run: `npm run dev` (in another terminal)
- Open the taskpane, confirm English strings unchanged.
- Stop the dev server (Stage 1 has no UI for language switching yet — Settings UI lands in Task 16). For now, force Hebrew by running in the browser console:
  `localStorage.setItem('autooffice_language','he'); location.reload();`
- Confirm Hebrew strings render and document `dir="rtl"`.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/components/ChatPanel.tsx
git commit -m "i18n: migrate ChatPanel strings to t()"
```

---

### Task 14: Migrate `CodeBlock` and `ToolActivity` strings

**Files:**
- Modify: `src/taskpane/components/CodeBlock.tsx`
- Modify: `src/taskpane/components/ToolActivity.tsx`

- [ ] **Step 1: `CodeBlock.tsx` — replace status map and button labels**

Add `import { useTranslation } from '../i18n/index.ts';` at the top.

Inside the component body, add `const { t } = useTranslation();`.

Replace the existing top-level `STATUS_LABELS` constant (the object literal with `pending: 'Awaiting Approval'`, etc., around line 104-108) with a per-render lookup:

```tsx
const STATUS_LABELS = {
  pending:  t('code.statusPending'),
  rejected: t('code.statusRejected'),
  running:  t('code.statusRunning'),
  success:  t('code.statusSuccess'),
  error:    t('code.statusError'),
} as const;
```

(That means moving the constant into the component body, since it now depends on `t`.)

Replace `Approve & Run` with `{t('code.approveButton')}` on the primary button, `Reject` with `{t('code.rejectButton')}` on the subtle button, `Error details` / `Result` (the `<summary>` text) with `{isError ? t('code.errorDetails') : t('code.result')}`.

- [ ] **Step 2: `ToolActivity.tsx` — replace `looked up: …` literal**

Replace the file body with:

```tsx
import React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import { Checkmark12Regular } from '@fluentui/react-icons';
import { useTranslation } from '../i18n/index.ts';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
});

export function ToolActivity({ toolName }: { toolName: string }) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <Checkmark12Regular />
      <Text size={200} italic>{t('code.toolActivity', { toolName })}</Text>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/components/CodeBlock.tsx src/taskpane/components/ToolActivity.tsx
git commit -m "i18n: migrate CodeBlock and ToolActivity strings to t()"
```

---

### Task 15: Migrate `SettingsPanel` strings (without language section yet)

**Files:**
- Modify: `src/taskpane/components/SettingsPanel.tsx`

- [ ] **Step 1: Add hook import and call**

Add `import { useTranslation } from '../i18n/index.ts';`. Add `const { t } = useTranslation();` near the top of the component body.

- [ ] **Step 2: Replace every UI string with the matching `t('settings.…')` key**

Walk the file top to bottom and replace:
- Header `"Settings"` → `t('settings.title')`
- Back button `"Back"` → `t('settings.backButton')`
- AI Provider section: `"AI Provider"` → `t('settings.providerSection')`; `"Provider"` → `t('settings.providerLabel')`; `"Select a provider..."` → `t('settings.providerPlaceholder')`; `"API Key"` → `t('settings.apiKeyLabel')`; `"Enter API key..."` → `t('settings.apiKeyPlaceholder')`; `"Base URL"` → `t('settings.baseUrlLabel')`; `"Model"` → `t('settings.modelLabel')`; `"Enter model name..."` → `t('settings.modelPlaceholder')`.
- Execution section: `"Execution"` → `t('settings.executionSection')`; `"Auto-approve code execution"` → `t('settings.autoApproveLabel')`; `"Max retry attempts"` → `t('settings.maxRetriesLabel')`; `"Execution timeout (seconds)"` → `t('settings.timeoutLabel')`.
- MCP section: `"MCP Servers"` → `t('settings.mcpSection')`; `"Add"` → `t('settings.mcpAddButton')`; the empty-list message → `t('settings.mcpNoServers')`; the name placeholder → `t('settings.mcpNamePlaceholder')`; the URL placeholder → `t('settings.mcpUrlPlaceholder')`.

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/components/SettingsPanel.tsx
git commit -m "i18n: migrate SettingsPanel non-language strings to t()"
```

---

### Task 16: Add language section to Settings UI

**Files:**
- Modify: `src/taskpane/components/SettingsPanel.tsx`

- [ ] **Step 1: Import locale registry**

At the top of the file, add:

```tsx
import { availableLocales, type LocaleId } from '../i18n/index.ts';
import { useTranslation } from '../i18n/index.ts';
```

(If `useTranslation` is already imported from Task 15, leave it.)

- [ ] **Step 2: Pull locale + setter from the hook**

Modify the `useTranslation()` destructuring to also pull `locale` and `setLocale`:

```tsx
const { t, locale, setLocale } = useTranslation();
```

- [ ] **Step 3: Append a Language section to the form**

Inside the `content` flex column, after the MCP section, add:

```tsx
<div className={styles.section}>
  <Text weight="semibold" size={300}>{t('settings.languageSection')}</Text>
  <Field label={t('settings.languageLabel')}>
    <Select
      value={locale}
      aria-label={t('settings.languageLabel')}
      onChange={(_, data) => { void setLocale(data.value as LocaleId); }}
    >
      {availableLocales().map(l => (
        <option key={l.id} value={l.id}>{l.nativeName}</option>
      ))}
    </Select>
  </Field>
  <Text size={200} italic>{t('settings.languageDescription')}</Text>
</div>
```

- [ ] **Step 4: Run dev server and verify by hand**

Run: `npm run dev`
- Open taskpane, navigate to Settings.
- Confirm the **Language** section is visible at the bottom of the form.
- Switch to **עברית** — UI flips to Hebrew immediately, dropdown selected option shows `עברית`, `<html dir="rtl">`, layout mirrors via Fluent.
- Switch back to **English** — UI returns; `<html dir="ltr">`.
- Reload the page; selection persists.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/components/SettingsPanel.tsx
git commit -m "i18n: add language picker to Settings panel"
```

---

## Stage 2 — Multilingual agent

### Task 17: System prompt accepts a locale and instructs the LLM to reply in it

**Files:**
- Modify: `src/taskpane/agent/system-prompt.ts`
- Test: `src/taskpane/agent/system-prompt.test.ts` (new)

- [ ] **Step 1: Write failing test**

```ts
// src/taskpane/agent/system-prompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './system-prompt.ts';

describe('buildSystemPrompt', () => {
  it('contains an English-locale clause naming "English"', () => {
    const p = buildSystemPrompt('word', ['document'], 'en');
    expect(p).toMatch(/Respond to the user in \*\*English\*\* \(en\)/);
  });

  it('contains a Hebrew-locale clause naming the native name', () => {
    const p = buildSystemPrompt('word', ['document'], 'he');
    expect(p).toMatch(/Respond to the user in \*\*עברית\*\* \(he\)/);
  });

  it('keeps locale clause near the end of the prompt', () => {
    const p = buildSystemPrompt('word', ['document'], 'he');
    const idx = p.indexOf('Respond to the user');
    expect(idx).toBeGreaterThan(p.length / 2);
  });

  it('still includes the office.js critical rules', () => {
    const p = buildSystemPrompt('word', ['document'], 'en');
    expect(p).toContain('CRITICAL RULES for office.js code');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/taskpane/agent/system-prompt.test.ts`
Expected: FAIL — wrong arity / clause missing.

- [ ] **Step 3: Update `src/taskpane/agent/system-prompt.ts`**

```ts
// src/taskpane/agent/system-prompt.ts
import type { HostKind } from '../host/context.ts';
import { LOCALES, type LocaleId } from '../i18n/index.ts';

export function buildSystemPrompt(
  host: HostKind,
  skills: readonly string[],
  locale: LocaleId,
): string {
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

  const meta = LOCALES[locale];
  const localeClause =
`User language: respond to the user in **${meta.nativeName}** (${locale}).
- Match the user's language for all explanations, status text, and error descriptions.
- Skill documentation provided to you is in English; translate concepts into ${meta.nativeName} when explaining to the user.
- Code identifiers (variable names, office.js API names) stay in English.`;

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

Your code can be either a full ${apiRoot}.run() block or just the inner body — the executor handles both.

${localeClause}`;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/taskpane/agent/system-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/agent/system-prompt.ts src/taskpane/agent/system-prompt.test.ts
git commit -m "agent: add locale parameter to system prompt; instruct model to reply in user's language"
```

---

### Task 18: Thread locale through the orchestrator

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts`

- [ ] **Step 1: Update the import**

Add at the top:

```ts
import { translationService } from '../i18n/index.ts';
```

- [ ] **Step 2: Pass the current locale into `buildSystemPrompt`**

Find the `buildSystemPrompt(host, skills)` call inside `runAgent` (it currently passes only host + skills). Replace with:

```ts
const systemPrompt = buildSystemPrompt(host, skills, translationService.getLocale());
```

If the result is currently inlined into `streamText({...})`, hoist it to a `const` first as shown above so the call is identical to the test's expectation.

- [ ] **Step 3: Type-check + run all tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`
- Switch UI to Hebrew via Settings.
- Send: `שנה את כל הכותרות לכחולות` (Word host).
- Confirm: agent's prose explanation comes back in Hebrew. Generated code identifiers remain English.
- Switch back to English; confirm agent replies in English.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/agent/orchestrator.ts
git commit -m "agent: thread current locale into system prompt"
```

---

## Stage 3 — Translator workflow + CI

### Task 19: Translation completeness checker

**Files:**
- Create: `tools/check-translations.ts`
- Test: `tools/check-translations.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing test**

```ts
// tools/check-translations.test.ts
import { describe, it, expect } from 'vitest';
import { diffKeys, flattenKeys } from './check-translations.ts';

describe('check-translations', () => {
  it('flattenKeys returns all leaf paths, depth-first', () => {
    expect(flattenKeys({ a: { b: 'x', c: 'y' }, d: 'z' }).sort())
      .toEqual(['a.b', 'a.c', 'd']);
  });

  it('diffKeys reports missing and extra', () => {
    const en = { common: { a: '1', b: '2' } };
    const he = { common: { a: '1', c: '3' } };
    const { missing, extra } = diffKeys(en, he);
    expect(missing).toEqual(['common.b']);
    expect(extra).toEqual(['common.c']);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run tools/check-translations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `tools/check-translations.ts`**

```ts
#!/usr/bin/env -S node --experimental-strip-types
// Verifies every registered locale's JSON has the same key shape as en.json.
// Exits non-zero on missing keys; warns on extras and likely-untranslated.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Json = { [k: string]: string | Json };

export function flattenKeys(obj: Json, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(path);
    else out.push(...flattenKeys(v as Json, path));
  }
  return out;
}

export function diffKeys(en: Json, other: Json): { missing: string[]; extra: string[] } {
  const a = new Set(flattenKeys(en));
  const b = new Set(flattenKeys(other));
  const missing = [...a].filter(k => !b.has(k)).sort();
  const extra = [...b].filter(k => !a.has(k)).sort();
  return { missing, extra };
}

function getNested(obj: Json, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

const PROPER_NOUN_KEYS = new Set([
  'common.appName',
  'settings.baseUrlPlaceholder',
  'settings.mcpUrlPlaceholder',
]);

async function main(): Promise<number> {
  const reg = await import('../src/taskpane/i18n/registry.ts');
  const en = JSON.parse(
    readFileSync(resolve('src/taskpane/i18n/locales/en.json'), 'utf8'),
  ) as Json;

  let failed = false;
  for (const id of Object.keys(reg.LOCALES)) {
    if (id === 'en') continue;
    const path = resolve(`src/taskpane/i18n/locales/${id}.json`);
    let other: Json;
    try {
      other = JSON.parse(readFileSync(path, 'utf8')) as Json;
    } catch (e) {
      console.error(`✗ ${id}: cannot read/parse ${path}: ${(e as Error).message}`);
      failed = true;
      continue;
    }
    const { missing, extra } = diffKeys(en, other);
    if (missing.length > 0) {
      failed = true;
      console.error(`✗ ${id}: missing ${missing.length} keys`);
      for (const k of missing) console.error(`    - ${k}`);
    }
    if (extra.length > 0) {
      console.warn(`! ${id}: ${extra.length} extra keys (not in en.json)`);
      for (const k of extra) console.warn(`    + ${k}`);
    }
    // Likely-untranslated: identical to en value, except whitelisted proper nouns.
    const untranslated: string[] = [];
    for (const key of flattenKeys(en)) {
      if (PROPER_NOUN_KEYS.has(key)) continue;
      const ev = getNested(en, key);
      const ov = getNested(other, key);
      if (typeof ev === 'string' && ev === ov) untranslated.push(key);
    }
    if (untranslated.length > 0) {
      console.warn(`! ${id}: ${untranslated.length} values identical to English (likely untranslated)`);
      for (const k of untranslated) console.warn(`    ~ ${k}`);
    }
    if (missing.length === 0 && extra.length === 0) {
      console.log(`✓ ${id}: ${flattenKeys(other).length} keys, complete`);
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => process.exit(code));
}
```

- [ ] **Step 4: Wire npm script in `package.json`**

Add to the `"scripts"` block:

```json
"check:i18n": "node --experimental-strip-types tools/check-translations.ts"
```

- [ ] **Step 5: Update `vitest.config.ts` to discover tests under `tools/`**

Replace the `include` line with:

```ts
include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
```

- [ ] **Step 6: Run unit test, expect PASS**

Run: `npx vitest run tools/check-translations.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the CLI against current locales, expect green**

Run: `npm run check:i18n`
Expected: prints `✓ he: <N> keys, complete` and exit 0.

- [ ] **Step 8: Commit**

```bash
git add tools/check-translations.ts tools/check-translations.test.ts package.json vitest.config.ts
git commit -m "i18n: add translation completeness checker (npm run check:i18n)"
```

---

### Task 20: PR CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: CI

on:
  pull_request:
    branches: [master]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run check:i18n
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run check:i18n + tests + build on PRs"
```

---

### Task 21: README — "Adding a language" section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a new section to `README.md`**

Add this section near the end of `README.md`, before any `License` heading:

```markdown
## Adding a Language

AutoOffice's UI and AI agent both run in the user's language.

To add a new language (example: French):

1. **Register the locale** in `src/taskpane/i18n/registry.ts`:

   ```ts
   export const LOCALES = {
     en: { name: 'English', nativeName: 'English',  direction: 'ltr', fallback: null },
     he: { name: 'Hebrew',  nativeName: 'עברית',    direction: 'rtl', fallback: 'en' },
     fr: { name: 'French',  nativeName: 'Français', direction: 'ltr', fallback: 'en' },
   } as const satisfies Record<string, LocaleMeta>;
   ```

2. **Translate the strings.** Copy `src/taskpane/i18n/locales/en.json` to `src/taskpane/i18n/locales/fr.json` and translate the values. Keep the keys identical and the `{{name}}` placeholders intact.

3. **Verify coverage:**

   ```bash
   npm run check:i18n
   ```

   You should see `✓ fr: N keys, complete`. Missing keys fail the build; extra keys are warnings.

That's it — the locale appears in the Settings → Language dropdown automatically, and the AI agent will reply in the new language for users who pick it.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add 'Adding a Language' section to README"
```

---

### Task 22: Open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/multi-language
```

- [ ] **Step 2: Open a PR**

```bash
gh pr create --title "Multi-language: registry-driven i18n + multilingual agent" --body "$(cat <<'EOF'
## Summary
- Registry-driven i18n: adding a language is one row in `LOCALES` + one JSON file.
- Lazy-loaded locale dictionaries; `Intl.*`-based formatters; generated `TranslationKey` literal-union for type safety.
- `<FluentProvider dir>` + CSS logical properties — drops the hand-rolled RTL hooks in PR #4.
- Agent system prompt now accepts the user's locale and instructs the model to reply in it. Code identifiers stay English.
- `npm run check:i18n` verifies coverage; CI runs on every PR.
- Ships `en` and `he`.

Supersedes / extends #4.

## Test plan
- [ ] `npm test` — all green
- [ ] `npm run check:i18n` — green for he
- [ ] Manual: switch UI to Hebrew, confirm RTL layout + Hebrew strings + `<html lang="he" dir="rtl">`
- [ ] Manual: with Hebrew UI, ask agent in Word "צבע את כל הכותרות בכחול" — verify reply prose is Hebrew, code is English
- [ ] Manual: switch back to English; confirm agent replies in English

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Capture the PR URL**

`gh pr view --json url -q .url`

---

## Self-review checklist (verify before marking the plan complete)

- [ ] Every spec section maps to at least one task: registry → T2; types → T1; en/he JSON → T3/T4; type-codegen → T5; loader → T6; service → T7; format → T8; detect → T9; storage → T10; provider/hooks/index → T11; FluentProvider+`<html lang>` → T11+T12; component migration → T13/T14/T15; Settings language picker → T16; agent system prompt → T17; orchestrator threading → T18; CI checker → T19; CI workflow → T20; README → T21; PR → T22.
- [ ] No "TBD"/"TODO"/"add error handling" placeholders.
- [ ] Type names consistent across tasks: `LocaleMeta`, `LocaleId`, `TranslationKey`, `TranslationDict`, `TranslationParams`, `LanguageContextValue`, `Formatters`.
- [ ] Function names consistent: `setLocale`, `getLocale`, `loadLocale`, `clearLoaderCache`, `loadStoredLocale`, `saveStoredLocale`, `detectLocale`, `normalizeLanguageTag`, `availableLocales`, `isLocaleId`, `getLocaleMeta`, `buildSystemPrompt`, `makeFormatters`.
- [ ] Translation keys used in component-migration tasks all appear in the canonical en.json shape (Task 3).

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-03-multi-language.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
