# Better Error Handling — Design

**Date:** 2026-05-03
**Branch (planned):** `feat/better-errors`

## Problem

Errors in AutoOffice routinely vanish or surface as opaque, single-line strings. Users see things like `Error: stream has no output` with no way to discover the underlying cause (bad API key, wrong model name, network failure, Office.js property-not-loaded, MCP server unreachable, etc.). Important error context is dropped at every layer:

| Layer | File / line | What's lost |
|---|---|---|
| MCP connect failures | `src/taskpane/mcp/client.ts:30` | Only logged with `console.warn`; user sees nothing in the chat. |
| Office.js sandbox errors | `src/taskpane/executor/sandbox.ts:79-82` | `OfficeExtension.Error.debugInfo` (errorLocation, statement, surroundingStatements, fullStatements, code) is discarded — only `e.message` and `e.stack` survive. |
| AI SDK stream errors | `src/taskpane/agent/orchestrator.ts:146-149` | `APICallError.responseBody`, `.statusCode`, `.url`, `.data`, `.cause` are dropped — `err.message` is often a generic SDK string like "stream has no output" while the real provider error is one level down. |
| Provider config errors | `src/taskpane/agent/providers.ts` | Plain `Error` strings, no visual cue or category. |
| Tool execution errors | `src/taskpane/agent/orchestrator.ts` (`executeCode`) | Tool body has no try/catch around its own logic; an internal throw (e.g. inside `requestApproval`) kills the stream with no surface explanation. |
| UI rendering | `src/taskpane/components/MessageBubble.tsx` | All errors rendered as plain "Error: …" assistant text — no visual distinction, no expand-for-details, no copy. |

## Goals

1. Show the user the **actual** underlying error, not a generic SDK surface message.
2. Make every error a chat message — never a silent `console.warn`.
3. Give the user a copy-paste-ready raw payload for bug reports.
4. Preserve the agent's existing self-healing loop (errors returned to the model are unchanged in shape — only what the user *sees* gets richer).

## Non-goals

- No retry-with-different-provider UI (separate feature).
- No telemetry / external error reporting.
- No structured logging beyond what already lands in chat.
- Not changing the agent's auto-retry behavior — the string the tool returns to the model stays the same shape.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ App.tsx (outer catch)                               │
│   ↓                                                 │
│ orchestrator.runAgent                               │
│   ├─ getMcpTools  → returns { tools, failures[] }   │
│   │     each failure → onMessage(error bubble)      │
│   ├─ executeCode tool                               │
│   │     try/catch → onMessage(error bubble) on throw│
│   │     sandbox.execute → debugInfo enrichment      │
│   └─ streamText consumer                            │
│         catch → formatError → onMessage(error)      │
│                                                     │
│ formatError (new agent/errors.ts)                   │
│   ↓ knows AI SDK / OfficeExtension / network shapes │
│   ↓                                                 │
│ ErrorBubble.tsx (new) — red bubble + raw details    │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. `src/taskpane/agent/errors.ts` — error formatter (new file)

```ts
export type ErrorKind = 'api' | 'office' | 'sandbox' | 'mcp' | 'config' | 'network' | 'unknown';

export interface FormattedError {
  kind: ErrorKind;
  title: string;       // short heading, e.g. "Anthropic API error (401)"
  detail: string;      // primary plain-language explanation
  raw?: string;        // pretty-printed JSON of all extracted fields, for "Show details" + copy
}

export interface ErrorContext {
  provider?: string;     // human-readable provider name, e.g. "Anthropic"
  model?: string;        // selected model id
  tool?: string;         // tool name when the error came from a tool execution
  serverName?: string;   // MCP server name when phase === 'mcp-connect'
  phase?: 'mcp-connect' | 'stream' | 'tool-execute' | 'agent';
}

export function formatError(err: unknown, ctx?: ErrorContext): FormattedError;
```

**Detection (duck-typed, no instanceof since SDK error classes are not stably exported):**

| Match | Source |
|---|---|
| `err.name === 'AI_APICallError'` or has `responseBody` + `statusCode` | AI SDK `APICallError` — pull `statusCode`, `url`, `responseBody`, `data`, `cause` |
| `err.name === 'AI_LoadAPIKeyError'` | AI SDK `LoadAPIKeyError` — kind `config` |
| `err.name === 'AI_NoSuchModelError'` or `'AI_NoSuchProviderError'` | kind `config` |
| `err.name === 'ConfigError'` | thrown by `providers.ts` validation — kind `config` |
| `err.name === 'AI_NoContentGeneratedError'` or `'AI_InvalidResponseDataError'` | kind `api` |
| `'code' in err && 'debugInfo' in err` | `OfficeExtension.Error` — pull `code`, `debugInfo.errorLocation`, `.statement`, `.surroundingStatements`, `.fullStatements`, `.message` |
| `err.message === 'Failed to fetch'` or `err.name === 'TypeError'` with fetch-y message | kind `network` |
| `err.name === 'AbortError'` | kind `network` (user navigated away / cancellation) |
| fallback | kind `unknown`, use `err.message + err.stack` |

**Title format examples:**
- `"Anthropic API error (401 Unauthorized)"` — provider from `ctx`, status from extracted
- `"Office.js error: GeneralException"` — `code` from `OfficeExtension.Error`
- `"MCP server 'sefaria' unreachable"` — server name from `ctx.serverName`
- `"Configuration error"` — for `config` kind
- `"Network error"` — for `network` kind

**Detail body:**
- For `api`: best-effort parse `responseBody` as JSON and surface `error.message` if present, else show raw body.
- For `office`: `debugInfo.message` (often more helpful than `err.message`) + `errorLocation` + `statement`.
- For `mcp`: `err.message` + URL.
- Fallback: `err.message`.

**Raw:**
- Always populated when `kind !== 'unknown'`. Pretty-printed `JSON.stringify(extracted, null, 2)`. For `unknown`, set to `err.stack` if available.

### 2. `ChatMessage` extension + `ErrorBubble.tsx` (new file)

Extend `src/taskpane/agent/orchestrator.ts`:

```ts
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: { /* unchanged */ };
  toolActivity?: { /* unchanged */ };
  error?: {
    kind: ErrorKind;
    title: string;
    detail: string;
    raw?: string;
  };
}
```

`MessageBubble.tsx` gains a branch: if `message.error`, render `<ErrorBubble {...message.error} />`.

`src/taskpane/components/ErrorBubble.tsx`:
- Red-bordered container using existing `tokens.colorPaletteRedBackground1` / `tokens.colorPaletteRedForeground1` (matches `CodeBlock`'s error-state styling for consistency).
- Bold title row.
- Detail body in default text.
- Collapsible `<details>` "Technical details" containing the `raw` payload in monospace pre.
- Single **Copy** button (uses `navigator.clipboard.writeText`) that copies `${title}\n\n${detail}\n\n${raw ?? ''}` so the user can paste into a bug report.

### 3. Wiring — `src/taskpane/agent/orchestrator.ts`

#### 3a. MCP failures surfaced

Replace the call site:

```ts
// Before:
const mcpTools = await getMcpTools(settings.mcpServers);

// After:
const { tools: mcpTools, failures } = await getMcpTools(settings.mcpServers);
for (const f of failures) {
  callbacks.onMessage({
    role: 'assistant',
    content: '',
    error: formatError(f.error, { serverName: f.serverName, phase: 'mcp-connect' }),
  });
}
```

#### 3b. `executeCode` tool — wrap in try/catch

```ts
execute: async ({ code }) => {
  try {
    // ...existing body...
  } catch (err) {
    const formatted = formatError(err, { phase: 'tool-execute', tool: 'execute_code' });
    callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
    return `Tool failed: ${formatted.title}. ${formatted.detail}`;
  }
}
```

The string returned to the model preserves the existing self-healing contract — the model sees a plain text description and can adjust.

#### 3c. Stream consumer

```ts
// Before:
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  callbacks.onMessage({ role: 'assistant', content: `Error: ${msg}` });
  return messages;
}

// After:
} catch (err) {
  const formatted = formatError(err, {
    phase: 'stream',
    provider: settings.providers.find(p => p.id === settings.selectedProviderId)?.name,
    model: settings.selectedModel,
  });
  callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
  return messages;
}
```

### 4. `src/taskpane/App.tsx` outer catch

This single catch covers two paths: (a) provider misconfiguration thrown from `createModel` in `providers.ts`, and (b) any uncaught error escaping `runAgent`. To classify (a) cleanly, `errors.ts` exports a small `ConfigError` class:

```ts
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

`providers.ts` is updated to throw `ConfigError` instead of plain `Error` for its five validation checks (no provider selected, no API key, no model, no base URL, unknown provider). `formatError` detects `err.name === 'ConfigError'` → `kind: 'config'`, with title `"Configuration error"` and detail = `err.message`.

Replace:

```ts
} catch (e) {
  const errorMsg = e instanceof Error ? e.message : String(e);
  setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}` }]);
}
```

With:

```ts
} catch (e) {
  const formatted = formatError(e, { phase: 'agent' });
  setMessages(prev => [...prev, { role: 'assistant', content: '', error: formatted }]);
}
```

### 5. `src/taskpane/executor/sandbox.ts` — Office.js debug info

Extend `ExecutionResult`:

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

In the catch block:

```ts
} catch (err) {
  const e = err as Error & { code?: string; debugInfo?: OfficeExtension.Error['debugInfo'] };
  const isOfficeError = typeof e.code === 'string' && e.debugInfo !== undefined;
  if (isOfficeError) {
    return {
      success: false,
      error: `${e.code}: ${e.message || e.debugInfo?.message || ''}`,
      stack: e.stack,
      debugInfo: { code: e.code, ...e.debugInfo },
      logs,
    };
  }
  return { success: false, error: e.message || String(err), stack: e.stack, logs };
}
```

In the orchestrator, when assembling `uiResult` for an error CodeBlock, include the debug-info section:

```ts
const debugSection = result.debugInfo
  ? `Office.js debug info:\nCode: ${result.debugInfo.code ?? ''}\nLocation: ${result.debugInfo.errorLocation ?? ''}\nStatement: ${result.debugInfo.statement ?? ''}\nSurrounding:\n${(result.debugInfo.surroundingStatements ?? []).join('\n')}`
  : '';
const uiResult = [
  `Error: ${result.error}`,
  result.stack || '',
  debugSection,
  result.logs && result.logs.length ? `Logs:\n${result.logs.join('\n')}` : '',
].filter(Boolean).join('\n\n');
```

The string returned to the model also gains the debug section so the agent can self-heal more accurately.

### 6. `src/taskpane/mcp/client.ts` — surface failures

```ts
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
      const client = await createMCPClient({ /* unchanged */ });
      const tools = await client.tools();
      Object.assign(allTools, tools);
    } catch (e) {
      failures.push({ serverName: server.name, url: server.url, error: e });
    }
  }
  return { tools: allTools, failures };
}
```

`console.warn` is removed.

## Data flow

1. User sends message → `App.handleSend` → `runAgent`.
2. `runAgent` calls `getMcpTools`, surfaces any connect failures as error bubbles **before** asking the LLM.
3. LLM streams; if `streamText` throws (network, auth, model error) → `formatError` → error bubble.
4. LLM calls `execute_code` → sandbox runs → Office.js error → enriched `ExecutionResult` → CodeBlock displays full debug info, agent gets enriched string for retry.
5. If the tool function itself throws (not a sandbox failure but a code path bug) → `formatError` → error bubble + descriptive return string to the model.
6. Any uncaught path → outer `App.handleSend` catch → `formatError` → error bubble.

## Testing

The current codebase has no test runner. Verification is manual:

| Scenario | Trigger | Expected |
|---|---|---|
| Bad API key | Set Anthropic key to `sk-bogus` | Red bubble: title `"Anthropic API error (401 …)"`, detail with provider's `error.message` |
| Wrong model name | Set model to `nonexistent-model` | Red bubble showing provider's "model not found" body |
| Network down | Disconnect, send | Red bubble `kind: network`, detail "Failed to fetch" |
| MCP server unreachable | Configure invalid MCP URL, send any message | Red bubble per failed server *before* model response |
| Office.js property-not-loaded | Have agent read a property without `load()` | CodeBlock error result includes `debugInfo` block |
| Office.js wrong namespace | Run `Word.run(...)` on Excel host | Existing pre-flight error (no regression) |
| Sandbox timeout | Code with infinite loop | Existing timeout message (no regression) |

## Implementation order

1. `agent/errors.ts` (formatter + `ConfigError` class, no callers yet — pure module).
2. `ErrorBubble.tsx` + `MessageBubble.tsx` branch + `ChatMessage.error` field.
3. Wire `App.tsx` outer catch.
4. Update `providers.ts` to throw `ConfigError`.
5. Wire `orchestrator.ts` stream-consumer catch.
6. `mcp/client.ts` shape change + orchestrator surfaces failures.
7. `executeCode` tool try/catch.
8. `sandbox.ts` debugInfo enrichment + orchestrator UI string.
9. Manual verification across the test scenarios above.

## Out of scope (future work)

- Distinct visual treatment for `mcp` warning vs hard error (both red for now).
- A "Retry" button on error bubbles.
- Aggregating duplicate consecutive errors.
- Persisting errors to local history (will fall out of existing local-history work if added).
