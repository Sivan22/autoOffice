# Better Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace silent `console.warn` and opaque "stream has no output" surface messages with rich, copyable error chat bubbles that show the actual underlying API/Office.js/network/MCP failure.

**Architecture:** A single pure module (`agent/errors.ts`) duck-types AI SDK errors, `OfficeExtension.Error`, network failures, and a new `ConfigError` to produce a `FormattedError` with title/detail/raw. A new `ErrorBubble.tsx` component renders these as red chat bubbles with collapsible technical details and a copy button. Wiring touches every error path: orchestrator stream catch, `executeCode` tool, MCP client, sandbox, App.tsx outer catch, and `providers.ts`.

**Tech Stack:** React 19, Fluent UI v9, TypeScript 6, Vitest, @testing-library/react, AI SDK (`ai`), `@ai-sdk/mcp`, Office.js.

**Spec:** `docs/superpowers/specs/2026-05-03-better-error-handling-design.md`

---

## File Structure

| File | Purpose | New / Modified |
|---|---|---|
| `src/taskpane/agent/errors.ts` | `formatError()`, `FormattedError`, `ErrorKind`, `ErrorContext`, `ConfigError` class | **New** |
| `src/taskpane/agent/errors.test.ts` | Unit tests for `formatError` across all detection branches | **New** |
| `src/taskpane/components/ErrorBubble.tsx` | Red chat bubble with title/detail/raw/copy | **New** |
| `src/taskpane/components/ErrorBubble.test.tsx` | RTL tests | **New** |
| `src/taskpane/agent/orchestrator.ts` | Add `error` to `ChatMessage`, replace stream catch, surface MCP failures, wrap `executeCode`, enrich CodeBlock UI string with `debugInfo` | Modified |
| `src/taskpane/components/MessageBubble.tsx` | Render `ErrorBubble` when `message.error` present | Modified |
| `src/taskpane/App.tsx` | Outer catch uses `formatError` | Modified |
| `src/taskpane/agent/providers.ts` | Throw `ConfigError` from validation paths | Modified |
| `src/taskpane/mcp/client.ts` | Return `{ tools, failures[] }` instead of swallowing | Modified |
| `src/taskpane/mcp/client.test.ts` | Failures-array test (server unreachable) | **New** |
| `src/taskpane/executor/sandbox.ts` | Capture `OfficeExtension.Error.debugInfo` into `ExecutionResult` | Modified |
| `src/taskpane/executor/sandbox.test.ts` | Sandbox debugInfo test | **New** |

---

## Task 1: errors.ts — types, ConfigError, formatError skeleton

**Files:**
- Create: `src/taskpane/agent/errors.ts`
- Test: `src/taskpane/agent/errors.test.ts`

- [ ] **Step 1: Write the failing tests for the unknown / fallback branch**

Create `src/taskpane/agent/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatError, ConfigError } from './errors.ts';

describe('formatError — fallback', () => {
  it('handles a plain Error', () => {
    const out = formatError(new Error('boom'));
    expect(out.kind).toBe('unknown');
    expect(out.title).toBe('Unexpected error');
    expect(out.detail).toBe('boom');
    expect(out.raw).toContain('boom');
  });

  it('handles a non-Error throw (string)', () => {
    const out = formatError('weird');
    expect(out.kind).toBe('unknown');
    expect(out.detail).toBe('weird');
  });

  it('handles null/undefined', () => {
    const out = formatError(undefined);
    expect(out.kind).toBe('unknown');
    expect(out.detail).toBe('Unknown error');
  });
});

describe('formatError — ConfigError', () => {
  it('classifies ConfigError as kind=config', () => {
    const out = formatError(new ConfigError('No API key configured for Anthropic.'));
    expect(out.kind).toBe('config');
    expect(out.title).toBe('Configuration error');
    expect(out.detail).toBe('No API key configured for Anthropic.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/taskpane/agent/errors.test.ts`
Expected: FAIL — module `./errors.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/taskpane/agent/errors.ts`:

```ts
export type ErrorKind = 'api' | 'office' | 'sandbox' | 'mcp' | 'config' | 'network' | 'unknown';

export interface FormattedError {
  kind: ErrorKind;
  title: string;
  detail: string;
  raw?: string;
}

export interface ErrorContext {
  provider?: string;
  model?: string;
  tool?: string;
  serverName?: string;
  phase?: 'mcp-connect' | 'stream' | 'tool-execute' | 'agent';
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatError(err: unknown, _ctx: ErrorContext = {}): FormattedError {
  if (err === null || err === undefined) {
    return { kind: 'unknown', title: 'Unexpected error', detail: 'Unknown error' };
  }

  if (typeof err === 'string') {
    return { kind: 'unknown', title: 'Unexpected error', detail: err };
  }

  if (err instanceof Error) {
    if (err.name === 'ConfigError') {
      return {
        kind: 'config',
        title: 'Configuration error',
        detail: err.message,
        raw: err.stack,
      };
    }
    return {
      kind: 'unknown',
      title: 'Unexpected error',
      detail: err.message || 'Unknown error',
      raw: err.stack || safeStringify({ name: err.name, message: err.message }),
    };
  }

  return { kind: 'unknown', title: 'Unexpected error', detail: safeStringify(err) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/taskpane/agent/errors.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/agent/errors.ts src/taskpane/agent/errors.test.ts
git commit -m "Add errors.ts skeleton with ConfigError and unknown-fallback formatting"
```

---

## Task 2: errors.ts — AI SDK API call detection

**Files:**
- Modify: `src/taskpane/agent/errors.ts`
- Test: `src/taskpane/agent/errors.test.ts`

- [ ] **Step 1: Add failing tests for AI SDK error shapes**

Append to `src/taskpane/agent/errors.test.ts`:

```ts
describe('formatError — AI SDK APICallError', () => {
  function makeApiError(extras: Record<string, unknown>): Error {
    const e = new Error('API call failed');
    e.name = 'AI_APICallError';
    Object.assign(e, extras);
    return e;
  }

  it('extracts statusCode and parsed responseBody.error.message', () => {
    const err = makeApiError({
      statusCode: 401,
      url: 'https://api.anthropic.com/v1/messages',
      responseBody: JSON.stringify({ error: { message: 'invalid x-api-key' } }),
    });
    const out = formatError(err, { provider: 'Anthropic' });
    expect(out.kind).toBe('api');
    expect(out.title).toBe('Anthropic API error (401)');
    expect(out.detail).toBe('invalid x-api-key');
    expect(out.raw).toContain('401');
    expect(out.raw).toContain('invalid x-api-key');
  });

  it('falls back to raw responseBody when not JSON', () => {
    const err = makeApiError({ statusCode: 500, responseBody: 'gateway down' });
    const out = formatError(err, { provider: 'OpenAI' });
    expect(out.title).toBe('OpenAI API error (500)');
    expect(out.detail).toBe('gateway down');
  });

  it('omits provider name when ctx has none', () => {
    const err = makeApiError({ statusCode: 429 });
    const out = formatError(err);
    expect(out.title).toBe('API error (429)');
  });

  it('detects via duck-typing when name is missing', () => {
    const err = new Error('failed');
    Object.assign(err, { statusCode: 403, responseBody: '{}' });
    const out = formatError(err, { provider: 'Groq' });
    expect(out.kind).toBe('api');
    expect(out.title).toBe('Groq API error (403)');
  });
});

describe('formatError — AI SDK config-shaped errors', () => {
  it('classifies AI_LoadAPIKeyError as kind=config', () => {
    const err = new Error('GROQ_API_KEY env var not set');
    err.name = 'AI_LoadAPIKeyError';
    const out = formatError(err);
    expect(out.kind).toBe('config');
    expect(out.title).toBe('Configuration error');
  });

  it('classifies AI_NoSuchModelError as kind=config', () => {
    const err = new Error('Model bogus-1 not found');
    err.name = 'AI_NoSuchModelError';
    const out = formatError(err);
    expect(out.kind).toBe('config');
  });
});

describe('formatError — AI SDK API-shaped errors (non-call)', () => {
  it('classifies AI_NoContentGeneratedError as kind=api', () => {
    const err = new Error('No content generated');
    err.name = 'AI_NoContentGeneratedError';
    const out = formatError(err, { provider: 'OpenAI', model: 'gpt-5' });
    expect(out.kind).toBe('api');
    expect(out.title).toBe('OpenAI returned no content');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/taskpane/agent/errors.test.ts`
Expected: FAIL — new "kind=api" / "kind=config (AI SDK)" tests fail.

- [ ] **Step 3: Add detection logic before the unknown-fallback**

Edit `src/taskpane/agent/errors.ts` — replace the `formatError` function body. Add the helpers and new branches:

```ts
function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

function extractApiDetail(responseBody: unknown): string | undefined {
  if (typeof responseBody !== 'string') return undefined;
  const parsed = tryParseJson(responseBody);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const errField = obj.error;
    if (errField && typeof errField === 'object') {
      const msg = (errField as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.length > 0) return msg;
    }
    if (typeof obj.message === 'string' && obj.message.length > 0) return obj.message;
  }
  return responseBody;
}

function isApiCallError(err: Error & Record<string, unknown>): boolean {
  if (err.name === 'AI_APICallError') return true;
  return typeof err.statusCode === 'number' && 'responseBody' in err;
}

const CONFIG_ERROR_NAMES = new Set([
  'ConfigError',
  'AI_LoadAPIKeyError',
  'AI_NoSuchModelError',
  'AI_NoSuchProviderError',
]);

const API_ERROR_NAMES = new Set([
  'AI_NoContentGeneratedError',
  'AI_InvalidResponseDataError',
]);

export function formatError(err: unknown, ctx: ErrorContext = {}): FormattedError {
  if (err === null || err === undefined) {
    return { kind: 'unknown', title: 'Unexpected error', detail: 'Unknown error' };
  }
  if (typeof err === 'string') {
    return { kind: 'unknown', title: 'Unexpected error', detail: err };
  }
  if (!(err instanceof Error)) {
    return { kind: 'unknown', title: 'Unexpected error', detail: safeStringify(err) };
  }

  const e = err as Error & Record<string, unknown>;

  if (CONFIG_ERROR_NAMES.has(e.name)) {
    return {
      kind: 'config',
      title: 'Configuration error',
      detail: e.message,
      raw: e.stack,
    };
  }

  if (isApiCallError(e)) {
    const status = typeof e.statusCode === 'number' ? e.statusCode : undefined;
    const providerPart = ctx.provider ? `${ctx.provider} ` : '';
    const statusPart = status !== undefined ? ` (${status})` : '';
    const detail = extractApiDetail(e.responseBody) ?? e.message;
    return {
      kind: 'api',
      title: `${providerPart}API error${statusPart}`,
      detail,
      raw: safeStringify({
        name: e.name,
        message: e.message,
        statusCode: status,
        url: e.url,
        responseBody: e.responseBody,
        data: e.data,
        provider: ctx.provider,
        model: ctx.model,
      }),
    };
  }

  if (API_ERROR_NAMES.has(e.name)) {
    const providerPart = ctx.provider ? `${ctx.provider} ` : '';
    const title = e.name === 'AI_NoContentGeneratedError'
      ? `${providerPart}returned no content`.trim().replace(/^returned/, 'API returned')
      : `${providerPart}API error`.trim();
    return {
      kind: 'api',
      title: ctx.provider && e.name === 'AI_NoContentGeneratedError'
        ? `${ctx.provider} returned no content`
        : title,
      detail: e.message || 'No detail available',
      raw: safeStringify({ name: e.name, message: e.message, model: ctx.model, provider: ctx.provider }),
    };
  }

  return {
    kind: 'unknown',
    title: 'Unexpected error',
    detail: e.message || 'Unknown error',
    raw: e.stack || safeStringify({ name: e.name, message: e.message }),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/taskpane/agent/errors.test.ts`
Expected: PASS — all `formatError` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/agent/errors.ts src/taskpane/agent/errors.test.ts
git commit -m "Detect AI SDK APICallError and config-shaped errors in formatError"
```

---

## Task 3: errors.ts — Office.js, network, MCP detection

**Files:**
- Modify: `src/taskpane/agent/errors.ts`
- Test: `src/taskpane/agent/errors.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/taskpane/agent/errors.test.ts`:

```ts
describe('formatError — OfficeExtension.Error', () => {
  it('extracts code, errorLocation, statement', () => {
    const err = new Error('A property on this object was not loaded');
    Object.assign(err, {
      code: 'PropertyNotLoaded',
      debugInfo: {
        code: 'PropertyNotLoaded',
        message: 'The property "text" is not available.',
        errorLocation: 'Paragraph.text',
        statement: 'paragraph.text',
        surroundingStatements: ['paragraph.load(\'style\')', 'paragraph.text'],
        fullStatements: [],
      },
    });
    const out = formatError(err);
    expect(out.kind).toBe('office');
    expect(out.title).toBe('Office.js error: PropertyNotLoaded');
    expect(out.detail).toContain('The property "text" is not available.');
    expect(out.detail).toContain('Paragraph.text');
    expect(out.raw).toContain('surroundingStatements');
  });
});

describe('formatError — network', () => {
  it('classifies "Failed to fetch" TypeError', () => {
    const err = new TypeError('Failed to fetch');
    const out = formatError(err);
    expect(out.kind).toBe('network');
    expect(out.title).toBe('Network error');
    expect(out.detail).toBe('Failed to fetch');
  });

  it('classifies AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    const out = formatError(err);
    expect(out.kind).toBe('network');
    expect(out.title).toBe('Request cancelled');
  });
});

describe('formatError — MCP', () => {
  it('uses ctx.serverName in title when phase is mcp-connect', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:9000');
    const out = formatError(err, { phase: 'mcp-connect', serverName: 'sefaria' });
    expect(out.kind).toBe('mcp');
    expect(out.title).toBe('MCP server "sefaria" unreachable');
    expect(out.detail).toContain('ECONNREFUSED');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/taskpane/agent/errors.test.ts`
Expected: FAIL — new tests fail.

- [ ] **Step 3: Add detection branches**

Edit `src/taskpane/agent/errors.ts` — insert new branches **before** the `isApiCallError(e)` check (so a network failure that *also* looks api-shaped is still classified network only when truly network), and insert the MCP check **before** all others when `ctx.phase === 'mcp-connect'`:

Add helpers near the top:

```ts
function isOfficeError(e: Error & Record<string, unknown>): boolean {
  return typeof e.code === 'string' && typeof e.debugInfo === 'object' && e.debugInfo !== null;
}

function isNetworkError(e: Error): boolean {
  if (e.name === 'AbortError') return true;
  return e.name === 'TypeError' && /failed to fetch|networkerror|load failed/i.test(e.message);
}
```

Insert this block in `formatError`, right after the `e instanceof Error` cast:

```ts
  if (ctx.phase === 'mcp-connect') {
    return {
      kind: 'mcp',
      title: ctx.serverName ? `MCP server "${ctx.serverName}" unreachable` : 'MCP server unreachable',
      detail: e.message || 'Connection failed',
      raw: safeStringify({ name: e.name, message: e.message, serverName: ctx.serverName, stack: e.stack }),
    };
  }

  if (isOfficeError(e)) {
    const debug = e.debugInfo as Record<string, unknown>;
    const code = (e.code as string) || (debug.code as string) || 'Unknown';
    const dbgMsg = (debug.message as string) || e.message || '';
    const loc = debug.errorLocation as string | undefined;
    const stmt = debug.statement as string | undefined;
    const detailParts = [dbgMsg, loc ? `Location: ${loc}` : '', stmt ? `Statement: ${stmt}` : '']
      .filter(Boolean)
      .join('\n');
    return {
      kind: 'office',
      title: `Office.js error: ${code}`,
      detail: detailParts || e.message,
      raw: safeStringify({ code, debugInfo: debug, stack: e.stack }),
    };
  }

  if (isNetworkError(e)) {
    return {
      kind: 'network',
      title: e.name === 'AbortError' ? 'Request cancelled' : 'Network error',
      detail: e.message,
      raw: e.stack,
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/taskpane/agent/errors.test.ts`
Expected: PASS — all formatError tests (including all earlier branches) pass.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/agent/errors.ts src/taskpane/agent/errors.test.ts
git commit -m "Detect OfficeExtension, network, and MCP errors in formatError"
```

---

## Task 4: providers.ts — throw ConfigError

**Files:**
- Modify: `src/taskpane/agent/providers.ts`

- [ ] **Step 1: Read current state**

Open `src/taskpane/agent/providers.ts` — note the five `throw new Error(...)` calls (no provider, no API key, no model, no base URL, unknown provider).

- [ ] **Step 2: Replace plain Error with ConfigError**

Edit `src/taskpane/agent/providers.ts`:

Change the import at the top:

```ts
import type { LanguageModel } from 'ai';
import type { AppSettings } from '../store/settings.ts';
import { ConfigError } from './errors.ts';
```

Replace every `throw new Error(...)` with `throw new ConfigError(...)`. The five sites are at the top of `createModel` (provider/key/model checks) and inside `case 'openai-compatible'` (base URL check) and the `default:` branch (unknown provider).

- [ ] **Step 3: Add a typecheck/test verification**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run`
Expected: existing 45 tests still pass + the 19 new errors.ts tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/agent/providers.ts
git commit -m "Throw ConfigError from provider validation paths"
```

---

## Task 5: ErrorBubble component

**Files:**
- Create: `src/taskpane/components/ErrorBubble.tsx`
- Test: `src/taskpane/components/ErrorBubble.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/taskpane/components/ErrorBubble.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBubble } from './ErrorBubble.tsx';

describe('ErrorBubble', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders title and detail', () => {
    render(<ErrorBubble kind="api" title="Anthropic API error (401)" detail="invalid x-api-key" />);
    expect(screen.getByText('Anthropic API error (401)')).toBeInTheDocument();
    expect(screen.getByText('invalid x-api-key')).toBeInTheDocument();
  });

  it('hides technical details section when raw is missing', () => {
    render(<ErrorBubble kind="unknown" title="t" detail="d" />);
    expect(screen.queryByText(/technical details/i)).not.toBeInTheDocument();
  });

  it('shows technical details when raw is present', () => {
    render(<ErrorBubble kind="api" title="t" detail="d" raw='{"x":1}' />);
    expect(screen.getByText(/technical details/i)).toBeInTheDocument();
  });

  it('copies title + detail + raw to clipboard on Copy click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ErrorBubble kind="api" title="T" detail="D" raw="R" />);
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('T\n\nD\n\nR');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/taskpane/components/ErrorBubble.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/taskpane/components/ErrorBubble.tsx`:

```tsx
import React from 'react';
import { makeStyles, tokens, Button, Text } from '@fluentui/react-components';
import { Copy24Regular } from '@fluentui/react-icons';
import type { ErrorKind } from '../agent/errors.ts';

const useStyles = makeStyles({
  container: {
    alignSelf: 'stretch',
    margin: '4px 12px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    fontWeight: 600,
    fontSize: '13px',
  },
  detail: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  details: {
    marginTop: '4px',
  },
  summary: {
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    userSelect: 'none',
  },
  raw: {
    marginTop: '6px',
    padding: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '240px',
    overflow: 'auto',
    borderRadius: '4px',
  },
});

export interface ErrorBubbleProps {
  kind: ErrorKind;
  title: string;
  detail: string;
  raw?: string;
}

export function ErrorBubble({ title, detail, raw }: ErrorBubbleProps) {
  const styles = useStyles();
  const handleCopy = () => {
    const payload = [title, detail, raw ?? ''].filter(Boolean).join('\n\n');
    void navigator.clipboard?.writeText(payload);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text className={styles.title}>{title}</Text>
        <Button
          appearance="subtle"
          icon={<Copy24Regular />}
          size="small"
          onClick={handleCopy}
          aria-label="Copy"
        >
          Copy
        </Button>
      </div>
      <div className={styles.detail}>{detail}</div>
      {raw && (
        <details className={styles.details}>
          <summary className={styles.summary}>Technical details</summary>
          <pre className={styles.raw}>{raw}</pre>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wrap test render in FluentProvider**

The tests above don't wrap in `FluentProvider`. Look at `HistoryPanel.test.tsx` (the existing convention) — it renders without one and Fluent components work in jsdom. If tests fail because of theme tokens, wrap `render` in `<FluentProvider theme={webLightTheme}>`. First run as-is.

Run: `npx vitest run src/taskpane/components/ErrorBubble.test.tsx`
Expected: PASS — 4 tests.

If theme-related failures appear, edit the test file:

```tsx
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
const renderWith = (ui: React.ReactElement) =>
  render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
```

and replace `render(<ErrorBubble ...`> calls with `renderWith(<ErrorBubble ...`).

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/components/ErrorBubble.tsx src/taskpane/components/ErrorBubble.test.tsx
git commit -m "Add ErrorBubble component with collapsible details and copy button"
```

---

## Task 6: ChatMessage.error field + MessageBubble branch

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts:11-22`
- Modify: `src/taskpane/components/MessageBubble.tsx`

- [ ] **Step 1: Extend ChatMessage**

Edit `src/taskpane/agent/orchestrator.ts`:

Add the import near the top:

```ts
import type { FormattedError } from './errors.ts';
```

Replace the `ChatMessage` interface:

```ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: {
    code: string;
    status: 'pending' | 'rejected' | 'running' | 'success' | 'error';
    result?: string;
  };
  toolActivity?: {
    toolName: string;
  };
  error?: FormattedError;
}
```

- [ ] **Step 2: Render ErrorBubble in MessageBubble**

Edit `src/taskpane/components/MessageBubble.tsx`. Add the import:

```tsx
import { ErrorBubble } from './ErrorBubble.tsx';
```

Insert a new branch at the top of the function body, **before** the `toolActivity` check:

```tsx
if (message.error) {
  return (
    <div className={styles.container}>
      <ErrorBubble {...message.error} />
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck and existing tests still pass**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test`
Expected: 49 tests pass (45 original + 19 errors.ts + 4 ErrorBubble = 68; if "store/__smoke" or other counts differ, just confirm zero failures).

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/agent/orchestrator.ts src/taskpane/components/MessageBubble.tsx
git commit -m "Wire ChatMessage.error field through MessageBubble to ErrorBubble"
```

---

## Task 7: App.tsx outer catch uses formatError

**Files:**
- Modify: `src/taskpane/App.tsx:93-96`

- [ ] **Step 1: Add the import**

Edit `src/taskpane/App.tsx`. Add near the existing imports:

```ts
import { formatError } from './agent/errors.ts';
```

- [ ] **Step 2: Replace the catch block**

Replace lines 93-96 (the existing `} catch (e) { ... }` block in `handleSend`):

```ts
} catch (e) {
  const formatted = formatError(e, { phase: 'agent' });
  setMessages(prev => [...prev, { role: 'assistant', content: '', error: formatted }]);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/App.tsx
git commit -m "Format outer-catch errors via formatError in App.tsx"
```

---

## Task 8: orchestrator stream-consumer catch

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts:142-150`

- [ ] **Step 1: Add the import**

Edit `src/taskpane/agent/orchestrator.ts`. Update the existing `errors.ts` import (added in Task 6) to also pull `formatError`:

```ts
import { formatError, type FormattedError } from './errors.ts';
```

- [ ] **Step 2: Replace the stream-consumer catch**

Replace the existing block:

```ts
  try {
    for await (const chunk of result.textStream) {
      callbacks.onStreamToken(chunk);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    callbacks.onMessage({ role: 'assistant', content: `Error: ${msg}` });
    return messages;
  }
```

with:

```ts
  try {
    for await (const chunk of result.textStream) {
      callbacks.onStreamToken(chunk);
    }
  } catch (err) {
    const provider = settings.providers.find(p => p.id === settings.selectedProviderId)?.name;
    const formatted = formatError(err, {
      phase: 'stream',
      provider,
      model: settings.selectedModel,
    });
    callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
    return messages;
  }
```

- [ ] **Step 3: Typecheck and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + zero test failures.

- [ ] **Step 4: Commit**

```bash
git add src/taskpane/agent/orchestrator.ts
git commit -m "Format stream-consumer errors via formatError"
```

---

## Task 9: mcp/client.ts — surface failures

**Files:**
- Modify: `src/taskpane/mcp/client.ts`
- Test: `src/taskpane/mcp/client.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/taskpane/mcp/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMCPClient: vi.fn(),
}));

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: mocks.createMCPClient,
}));

import { getMcpTools } from './client.ts';
import type { McpServerConfig } from '../store/settings.ts';

const goodServer: McpServerConfig = {
  name: 'good', url: 'https://good.example/mcp', enabled: true, transport: 'streamable-http',
};
const badServer: McpServerConfig = {
  name: 'bad', url: 'https://bad.example/mcp', enabled: true, transport: 'streamable-http',
};

describe('getMcpTools', () => {
  beforeEach(() => mocks.createMCPClient.mockReset());

  it('returns connected server tools and collects failures', async () => {
    mocks.createMCPClient.mockImplementation(({ transport }: { transport: { url: string } }) => {
      if (transport.url.includes('bad')) return Promise.reject(new Error('ECONNREFUSED'));
      return Promise.resolve({ tools: () => Promise.resolve({ search: { description: 'x' } }) });
    });
    const result = await getMcpTools([goodServer, badServer]);
    expect(Object.keys(result.tools)).toEqual(['search']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].serverName).toBe('bad');
    expect((result.failures[0].error as Error).message).toBe('ECONNREFUSED');
  });

  it('skips disabled and url-less servers', async () => {
    const result = await getMcpTools([
      { name: 'off',  url: 'https://example/mcp', enabled: false, transport: 'streamable-http' },
      { name: 'none', url: '',                    enabled: true,  transport: 'streamable-http' },
    ]);
    expect(result.tools).toEqual({});
    expect(result.failures).toEqual([]);
    expect(mocks.createMCPClient).not.toHaveBeenCalled();
  });
});
```

Note: `McpServerConfig` is `{ name, url, transport: 'streamable-http' | 'sse', enabled }` — no `id` field.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/taskpane/mcp/client.test.ts`
Expected: FAIL — `result.failures` is undefined (current return is plain `ToolSet`).

- [ ] **Step 3: Update client.ts**

Replace the entire content of `src/taskpane/mcp/client.ts`:

```ts
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import type { McpServerConfig } from '../store/settings.ts';
import type { ToolSet } from 'ai';

function resolveUrl(url: string): string {
  if (import.meta.env.DEV && /^https?:\/\//.test(url)) {
    return `${window.location.origin}/api/mcp-proxy?target=${encodeURIComponent(url)}`;
  }
  return url;
}

export interface McpConnectFailure {
  serverName: string;
  url: string;
  error: unknown;
}

export interface McpToolsResult {
  tools: ToolSet;
  failures: McpConnectFailure[];
}

export async function getMcpTools(servers: McpServerConfig[]): Promise<McpToolsResult> {
  const allTools: ToolSet = {};
  const failures: McpConnectFailure[] = [];

  const enabledServers = servers.filter(s => s.enabled && s.url);

  for (const server of enabledServers) {
    try {
      const client = await createMCPClient({
        transport: {
          type: server.transport === 'sse' ? 'sse' : 'http',
          url: resolveUrl(server.url),
          fetch: (url: RequestInfo | URL, init?: RequestInit) => fetch(url, init),
        },
      });
      const tools = await client.tools();
      Object.assign(allTools, tools);
    } catch (e) {
      failures.push({ serverName: server.name, url: server.url, error: e });
    }
  }

  return { tools: allTools, failures };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/taskpane/mcp/client.test.ts`
Expected: PASS — both tests.

Run: `npx tsc --noEmit`
Expected: FAIL — `orchestrator.ts` still does `const mcpTools = await getMcpTools(...)` and treats the return as `ToolSet`. We fix that in Task 10.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/mcp/client.ts src/taskpane/mcp/client.test.ts
git commit -m "Return failures alongside tools from getMcpTools"
```

---

## Task 10: orchestrator surfaces MCP failures

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts:39-44` (the `getMcpTools` call site)

- [ ] **Step 1: Update the call site**

Edit `src/taskpane/agent/orchestrator.ts`. Replace:

```ts
  const mcpTools = await getMcpTools(settings.mcpServers);
```

with:

```ts
  const { tools: mcpTools, failures: mcpFailures } = await getMcpTools(settings.mcpServers);
  for (const f of mcpFailures) {
    callbacks.onMessage({
      role: 'assistant',
      content: '',
      error: formatError(f.error, { phase: 'mcp-connect', serverName: f.serverName }),
    });
  }
```

Note: this loop runs **before** the `callbacks.onMessage({ role: 'assistant', content: '' })` placeholder bubble at line 47. That placeholder will be created right after, into which the streamed response text accumulates.

- [ ] **Step 2: Typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + zero failures.

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/agent/orchestrator.ts
git commit -m "Surface MCP connect failures as error chat bubbles"
```

---

## Task 11: executeCode tool try/catch

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts:64-113` (the `execute` function)

- [ ] **Step 1: Wrap execute body**

Edit `src/taskpane/agent/orchestrator.ts`. Wrap the entire body of the `execute: async ({ code }) => { ... }` function in try/catch:

```ts
    execute: async ({ code }) => {
      try {
        const approved = settings.autoApprove || await callbacks.requestApproval(code);
        if (!approved) {
          callbacks.onMessage({
            role: 'assistant',
            content: '',
            codeBlock: { code, status: 'rejected' },
          });
          return 'User rejected the code. Ask what they would like changed.';
        }

        const result = await sandbox.execute(code, settings.executionTimeout);
        const logsStr = result.logs && result.logs.length ? `\nLogs:\n${result.logs.join('\n')}` : '';

        if (result.success) {
          const outputText = result.output === undefined
            ? 'undefined'
            : typeof result.output === 'string'
              ? result.output
              : JSON.stringify(result.output, null, 2);
          const uiResult = [
            `Output:\n${outputText}`,
            result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
          ].filter(Boolean).join('\n\n');
          callbacks.onMessage({
            role: 'assistant',
            content: '',
            codeBlock: { code, status: 'success', result: uiResult },
          });
          return `Code executed successfully. Output: ${JSON.stringify(result.output)}${logsStr}`;
        }

        const uiResult = [
          `Error: ${result.error}`,
          result.stack || '',
          result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
        ].filter(Boolean).join('\n\n');
        callbacks.onMessage({
          role: 'assistant',
          content: '',
          codeBlock: { code, status: 'error', result: uiResult },
        });

        retryCount++;
        if (retryCount >= settings.maxRetries) {
          return `Failed after ${retryCount} attempts. Last error: ${result.error}${logsStr}`;
        }
        return `Execution failed: ${result.error}\n${result.stack || ''}${logsStr}\nPlease fix and try again.`;
      } catch (err) {
        const formatted = formatError(err, { phase: 'tool-execute', tool: 'execute_code' });
        callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
        return `Tool failed: ${formatted.title}. ${formatted.detail}`;
      }
    },
```

(This is the same body as before plus a wrapping try/catch — the debugInfo enrichment of the error path comes in Task 12.)

- [ ] **Step 2: Typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + zero failures.

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/agent/orchestrator.ts
git commit -m "Wrap executeCode tool body in try/catch with formatted error"
```

---

## Task 12: sandbox debugInfo enrichment

**Files:**
- Modify: `src/taskpane/executor/sandbox.ts`
- Test: `src/taskpane/executor/sandbox.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/taskpane/executor/sandbox.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Sandbox } from './sandbox.ts';

describe('Sandbox.execute — Office.js debug info', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).Word = {
      run: async (fn: (ctx: unknown) => Promise<unknown>) => {
        const officeError = new Error('A property on this object was not loaded');
        Object.assign(officeError, {
          code: 'PropertyNotLoaded',
          debugInfo: {
            code: 'PropertyNotLoaded',
            message: 'The property "text" is not available.',
            errorLocation: 'Paragraph.text',
            statement: 'paragraph.text',
            surroundingStatements: ['paragraph.load("style")', 'paragraph.text'],
            fullStatements: [],
          },
        });
        await fn({});
        throw officeError;
      },
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).Word;
  });

  it('captures debugInfo on OfficeExtension.Error', async () => {
    const sandbox = new Sandbox('word');
    sandbox.init();
    const result = await sandbox.execute('return 1;');
    expect(result.success).toBe(false);
    expect(result.error).toContain('PropertyNotLoaded');
    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo?.errorLocation).toBe('Paragraph.text');
    expect(result.debugInfo?.statement).toBe('paragraph.text');
  });

  it('still works for plain errors (no debugInfo)', async () => {
    delete (globalThis as Record<string, unknown>).Word;
    (globalThis as Record<string, unknown>).Word = {
      run: async () => { throw new Error('plain'); },
    };
    const sandbox = new Sandbox('word');
    sandbox.init();
    const result = await sandbox.execute('return 1;');
    expect(result.success).toBe(false);
    expect(result.error).toBe('plain');
    expect(result.debugInfo).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/taskpane/executor/sandbox.test.ts`
Expected: FAIL — `result.debugInfo` is undefined.

- [ ] **Step 3: Update sandbox.ts**

Edit `src/taskpane/executor/sandbox.ts`:

Update `ExecutionResult`:

```ts
export interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  stack?: string;
  logs?: string[];
  debugInfo?: {
    code?: string;
    errorLocation?: string;
    statement?: string;
    surroundingStatements?: string[];
    fullStatements?: string[];
    message?: string;
  };
}
```

Replace the catch block inside `executionPromise`:

```ts
      } catch (err) {
        const e = err as Error & { code?: string; debugInfo?: ExecutionResult['debugInfo'] };
        const isOfficeError = typeof e.code === 'string' && e.debugInfo !== undefined;
        if (isOfficeError) {
          const dbg = e.debugInfo!;
          return {
            success: false,
            error: `${e.code}: ${e.message || dbg.message || ''}`.trim(),
            stack: e.stack,
            debugInfo: { code: e.code, ...dbg },
            logs,
          };
        }
        return { success: false, error: e.message || String(err), stack: e.stack, logs };
      }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/taskpane/executor/sandbox.test.ts`
Expected: PASS — both tests.

Run: `npm test`
Expected: full suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/taskpane/executor/sandbox.ts src/taskpane/executor/sandbox.test.ts
git commit -m "Capture OfficeExtension.Error debugInfo in sandbox ExecutionResult"
```

---

## Task 13: orchestrator surfaces debugInfo in CodeBlock UI string

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts` — the error branch of `executeCode` (the `uiResult` assembly)

- [ ] **Step 1: Add debug section helper**

Edit `src/taskpane/agent/orchestrator.ts`. Inside the `executeCode` execute body's error branch (after the try-wrapping from Task 11), replace the `uiResult` assignment:

```ts
        const debugSection = result.debugInfo
          ? [
              'Office.js debug info:',
              `Code: ${result.debugInfo.code ?? ''}`,
              `Location: ${result.debugInfo.errorLocation ?? ''}`,
              `Statement: ${result.debugInfo.statement ?? ''}`,
              result.debugInfo.surroundingStatements && result.debugInfo.surroundingStatements.length
                ? `Surrounding:\n${result.debugInfo.surroundingStatements.join('\n')}`
                : '',
            ].filter(Boolean).join('\n')
          : '';
        const uiResult = [
          `Error: ${result.error}`,
          result.stack || '',
          debugSection,
          result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
        ].filter(Boolean).join('\n\n');
```

Also augment the string returned to the model so it can self-heal:

```ts
        retryCount++;
        if (retryCount >= settings.maxRetries) {
          return `Failed after ${retryCount} attempts. Last error: ${result.error}${debugSection ? `\n${debugSection}` : ''}${logsStr}`;
        }
        return `Execution failed: ${result.error}\n${result.stack || ''}${debugSection ? `\n${debugSection}` : ''}${logsStr}\nPlease fix and try again.`;
```

- [ ] **Step 2: Typecheck and tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean + zero failures.

- [ ] **Step 3: Commit**

```bash
git add src/taskpane/agent/orchestrator.ts
git commit -m "Include Office.js debugInfo in CodeBlock error result and agent retry string"
```

---

## Task 14: Manual verification

**Files:** none

This is the manual smoke pass — the project has no end-to-end tests and Office.js can only be exercised inside Word/Excel/PowerPoint.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: clean build with no TypeScript errors.

- [ ] **Step 2: Sideload and run scenarios**

Sideload (`npm run start` for Word; equivalent commands for Excel/PowerPoint). For each scenario, confirm a red `ErrorBubble` appears with the expected title and that the **Copy** button copies title + detail + raw to clipboard.

| Scenario | Setup | Expected bubble |
|---|---|---|
| Bad API key | Set Anthropic API key in Settings to `sk-bogus`, send "hi" | Title: "Anthropic API error (401)" — detail mentions `invalid x-api-key` |
| Wrong model | Set model to `nonexistent-model-xyz`, send "hi" | Title: provider API error with 4xx — detail mentions model not found |
| Network down | Disconnect Wi-Fi, send "hi" | Title: "Network error" — detail "Failed to fetch" |
| MCP unreachable | Add MCP server `https://nonexistent.invalid/mcp`, enable it, send any message | Title: `MCP server "<name>" unreachable`, appears **before** any model response |
| Office.js debug info | Have agent run code that reads a property without `load()` (e.g. `return context.document.body.text;` in Word) | CodeBlock error result includes `Office.js debug info:` with `Code:`, `Location:`, `Statement:` |
| Tool internal failure | Reject every approval prompt to confirm rejection path is unchanged | "User rejected the code…" — no error bubble |
| Sandbox timeout | Code with `while(true){}` | CodeBlock error: "Execution timed out after 30000ms" — no regression |
| ConfigError path | Clear API key entirely in Settings, send "hi" | Bubble title: "Configuration error" — detail "No API key configured for …" |

- [ ] **Step 3: Final commit (if anything got tweaked)**

If the manual pass surfaces a copy/paste error or visual fix:

```bash
git add -p   # stage only the targeted fix
git commit -m "<targeted fix from manual verification>"
```

If nothing needed tweaking, skip this step.

---

## Self-Review Checklist (run before handoff)

- [x] Spec section "Architecture" — covered by Tasks 1, 2, 3, 5, 6, 8, 10, 11, 13
- [x] `formatError` AI SDK detection — Task 2
- [x] `formatError` Office.js detection — Task 3
- [x] `formatError` network detection — Task 3
- [x] `formatError` MCP detection — Task 3
- [x] `ConfigError` class — Task 1, used in Task 4
- [x] `ChatMessage.error` field — Task 6
- [x] `ErrorBubble.tsx` — Task 5
- [x] `MessageBubble.tsx` branch — Task 6
- [x] App.tsx outer catch — Task 7
- [x] orchestrator stream catch — Task 8
- [x] mcp/client.ts shape change — Task 9
- [x] orchestrator surfaces MCP failures — Task 10
- [x] executeCode try/catch — Task 11
- [x] sandbox debugInfo enrichment — Task 12
- [x] orchestrator UI string includes debug section — Task 13
- [x] Manual verification — Task 14
- [x] Type consistency: `FormattedError`, `ErrorKind`, `ErrorContext`, `ConfigError` names match across tasks
- [x] No placeholders / TBDs
