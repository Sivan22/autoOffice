# Local full-stack migration — design

**Date:** 2026-05-04
**Status:** Draft (awaiting review)

## Goals

1. Unblock CLI-bridge AI providers (Claude Code, Gemini CLI, OpenCode) and stdio MCP servers — both require Node APIs the browser cannot have.
2. Move state ownership (settings, provider keys, MCP config, chat history) from the browser to a local server, so Word, Excel, and PowerPoint instances share one source of truth and API keys never live in browser storage.
3. Keep AutoOffice's "private by design" pitch intact: nothing leaves the machine except direct provider API calls.

## Non-goals (v1)

- macOS/Linux installer. Windows-only for v1; revisit on demand.
- Auto-update. v1 ships "re-run installer to upgrade"; auto-update is a separate v2 effort.
- Multi-user / multi-tenant. The local server is owned by the logged-in user.
- OAuth-authenticated HTTP MCP servers. Cline has a `McpOAuthManager`; significant scope, deferred.
- Resumable streams across server restarts. The server keeps the stream alive across task-pane disconnects (via `consumeStream()`), but a server restart mid-turn loses the in-flight response.

## Architecture

### Topology

```
┌──────────────────────────── User's Windows machine ────────────────────────────┐
│                                                                                │
│  Office (Word/Excel/PPT)                AutoOffice service (per-user, at logon)│
│  ┌─────────────────────────┐            ┌──────────────────────────────────┐   │
│  │ Task pane WebView2      │            │  bun-compiled single .exe        │   │
│  │  https://localhost:47318│  HTTPS +   │  ┌─────────────────────────────┐ │   │
│  │   ┌───────────────────┐ │  Bearer    │  │ Hono                        │ │   │
│  │   │ React + useChat   │◄┼───────────►│  │  /api/chat (UI message      │ │   │
│  │   │  client-side tool │ │            │  │           stream over SSE)  │ │   │
│  │   │  exec via iframe  │ │            │  │  /api/conversations/*       │ │   │
│  │   └─────────┬─────────┘ │            │  │  /api/settings              │ │   │
│  │             │postMessage│            │  │  /api/providers/*           │ │   │
│  │   ┌─────────▼─────────┐ │            │  │  /api/mcp/*                 │ │   │
│  │   │ sandbox iframe    │ │            │  │  /bootstrap, /health        │ │   │
│  │   │ office.js execute │ │            │  │  GET /  → built static SPA  │ │   │
│  │   └───────────────────┘ │            │  └──────────┬──────────────────┘ │   │
│  └─────────────────────────┘            │             │                    │   │
│                                         │  ┌──────────▼──────────┐         │   │
│                                         │  │ AI SDK streamText   │         │   │
│                                         │  │ + provider registry │         │   │
│                                         │  └─┬──────────────┬────┘         │   │
│                                         │    │              │              │   │
│                                         │  HTTP           spawn            │   │
│                                         │    │              │              │   │
│                                         │  ┌─▼─────┐  ┌────▼────────────┐  │   │
│                                         │  │Anthr. │  │ claude / gemini │  │   │
│                                         │  │OpenAI │  │ opencode CLIs   │  │   │
│                                         │  │…      │  │ (user's auth)   │  │   │
│                                         │  └───────┘  └─────────────────┘  │   │
│                                         │                                  │   │
│                                         │  ┌────────────────────────────┐  │   │
│                                         │  │ McpHub                     │  │   │
│                                         │  │  stdio + sse + http        │  │   │
│                                         │  │  policy enforcement        │  │   │
│                                         │  └────────────────────────────┘  │   │
│                                         │                                  │   │
│                                         │  ┌────────────────────────────┐  │   │
│                                         │  │ bun:sqlite                 │  │   │
│                                         │  │ %LOCALAPPDATA%\AutoOffice  │  │   │
│                                         │  └────────────────────────────┘  │   │
│                                         └──────────────────────────────────┘   │
│                                                                                │
│  GitHub Pages (sivan22.github.io/autoOffice/)                                  │
│  Marketing only: landing, download installer, install/troubleshoot guide,      │
│  self-host instructions. No product code is served from Pages anymore.         │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Process model

- **Single bun-compiled binary** (`bun build --compile --target=bun-windows-x64`). Self-contained, ~50–80 MB, ships the static SPA bundled in.
- **Per-user auto-start at logon** via Scheduled Task `\AutoOffice\Service` (Run only when user is logged on). Falls back to `HKCU\…\Run` if Task Scheduler is unavailable.
- **Single instance** enforced by a named mutex. Second launch foregrounds the first via the tray menu.
- **System tray** in the same bun process, showing status and offering "Open guide", "Restart service", "Open log file", "Quit".
- **Installer requires admin** — same as today. Office add-in registration for end users still needs Trusted Catalog (a network-shared folder containing the manifest XML), and creating a Windows file share requires admin. The Developer registry path (`WEF\Developer\<guid>`) only works in Office's developer mode and is not suitable for end-user install. Trusted Catalog stays.
- **Service runs as the user, not as admin.** The Scheduled Task that auto-starts the bun binary runs in the user's session at logon — admin is only needed at install time, not at run time. This is what lets CLI providers (`claude`, `gemini`) read auth from `~/.claude/`, `~/.gemini/` etc.

### Endpoint security

- Bind `127.0.0.1:47318` only.
- Self-signed cert generated once at install time (SAN `localhost`, 10-year validity, CN includes a per-install random ID), added to `CurrentUser\Root`. Cert is removed on uninstall.
- Per-install bearer token (32-byte hex), stored in `%LOCALAPPDATA%\AutoOffice\config.json`.
- `GET /bootstrap` is the only unauthenticated route; it's origin-gated (only requests from `https://localhost:47318` succeed) and returns `{ token, version }` for the SPA to use on subsequent requests.
- All other routes require `Authorization: Bearer <token>`. Hono middleware enforces this.
- Tray menu offers "Rotate token" for compromise recovery.

## Repo structure (monorepo)

```
autoOffice/
├─ apps/
│  ├─ web/                     ← current src/taskpane moves here
│  │  ├─ src/
│  │  │  ├─ App.tsx            ← uses useChat
│  │  │  ├─ agent/             ← shrinks: only client-side tool runners
│  │  │  ├─ components/        ← ChatPanel, MessageBubble, parts renderers
│  │  │  ├─ executor/          ← iframe + postMessage (unchanged)
│  │  │  ├─ host/              ← Office.onReady + HostContext (unchanged)
│  │  │  ├─ i18n/              ← unchanged
│  │  │  └─ store/             ← thin wrappers around fetch('/api/...')
│  │  └─ vite.config.ts
│  └─ server/
│     ├─ src/
│     │  ├─ index.ts           ← bun entry: cert load, tray, Hono start
│     │  ├─ tray.ts            ← Windows tray icon + menu
│     │  ├─ routes/
│     │  │  ├─ chat.ts         ← POST /api/chat (UI message stream)
│     │  │  ├─ conversations.ts
│     │  │  ├─ settings.ts
│     │  │  ├─ providers.ts
│     │  │  ├─ mcp.ts
│     │  │  ├─ bootstrap.ts
│     │  │  └─ health.ts
│     │  ├─ providers/         ← server-only provider factory + CLI bridges
│     │  ├─ mcp/               ← McpHub: stdio + sse + http
│     │  ├─ tools/             ← built-in tools (lookup_skill, execute_code stub)
│     │  ├─ skills/            ← office.js skill markdown (moved from web)
│     │  ├─ db/                ← bun:sqlite + migrations
│     │  ├─ secrets/           ← DPAPI wrapper
│     │  └─ tls/               ← cert generation helper
│     └─ build.ts              ← bun --compile invocation
├─ packages/
│  └─ shared/                  ← types + zod schemas shared by web and server
│     └─ src/
│        ├─ schemas.ts         ← provider, mcp, settings, message metadata
│        └─ index.ts
├─ installer/
│  ├─ setup.iss
│  └─ resources/               ← cert helper, tray icon, license, README
├─ landing/                    ← GitHub Pages site (replaces deployed SPA)
│  ├─ index.html
│  ├─ guide/
│  └─ self-host/
└─ manifest.production.xml     ← SourceLocation now https://localhost:47318/
```

## Backend API

### `POST /api/chat`

Body (after `prepareSendMessagesRequest` collapses to last-message-only):

```ts
{
  id: string;                   // conversation id
  message: UIMessage;           // the new user message only
  providerId: string;           // selected provider
  modelId: string;              // selected model
  host: 'word' | 'excel' | 'powerpoint';  // for system prompt + skill scoping
  trigger: 'submit-user-message' | 'regenerate-assistant-message';
  messageId?: string;           // for regenerate
}
```

Server flow:

1. Validate bearer; load conversation history from SQLite.
2. Build `tools = { lookup_skill, execute_code, ...mcpTools }` filtered by per-tool policy: `deny` omitted; `ask` annotated `needsApproval: true`; `allow` annotated `needsApproval: false`. `execute_code` is always client-side (no `execute` on server) and respects the user's "Auto-approve" setting client-side.
3. Resolve provider via the server provider registry (including CLI bridges).
4. `streamText({ model, system, messages: convertToModelMessages(allMessages), tools, stopWhen: stepCountIs(20) })`. Per-host system prompt is composed before the call (Word vs Excel vs PowerPoint skill registry).
5. `result.consumeStream()` (no await) — keep the loop going if Office closes the pane mid-turn so `onFinish` still saves.
6. Return `result.toUIMessageStreamResponse({ originalMessages: history, generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }), onFinish: ({ messages }) => saveMessages(id, messages) })`.

### Other routes

| Route | Purpose |
|------|---------|
| `GET /api/conversations` | list, with id/title/host/updated_at |
| `POST /api/conversations` | create (returns id) |
| `GET /api/conversations/:id` | full message history (UIMessage[]) |
| `PATCH /api/conversations/:id` | rename |
| `DELETE /api/conversations/:id` | delete |
| `GET /api/settings`, `PUT /api/settings` | global settings (locale, autoApprove default, max steps, etc.) |
| `GET /api/providers` | configured providers, each with `{ id, kind, status, models }` |
| `POST /api/providers` | add provider (kind + config + key) |
| `PUT /api/providers/:id` | update |
| `DELETE /api/providers/:id` | remove |
| `POST /api/providers/:id/test` | dry-run validate |
| `GET /api/mcp/servers` | list with status |
| `POST /api/mcp/servers` | add (eager-connects on save) |
| `PUT /api/mcp/servers/:id` | update (live-update OR restart depending on diff) |
| `DELETE /api/mcp/servers/:id` | remove |
| `POST /api/mcp/servers/:id/restart` | manual reconnect |
| `GET /api/mcp/servers/:id/tools` | discovered tools + per-tool policy |
| `PUT /api/mcp/servers/:id/tools/:tool` | set policy `allow`/`ask`/`deny` |
| `GET /api/mcp/servers/:id/log` | recent stderr/error buffer |
| `GET /api/mcp/events` | SSE stream of `{ serverId, status, error? }` for live status badges |
| `GET /bootstrap` | unauthenticated, origin-gated; returns `{ token, version }` |
| `GET /health` | unauthenticated; returns `{ ok, version, port, pid, uptime }` |
| `GET /` and other static paths | the built React SPA |
| `GET /sandbox.html` | iframe sandbox page (unchanged content) |

### Status / progress streaming for MCP

For settings UI to show live MCP status (connecting/connected/error), `GET /api/mcp/events` is a server-sent events stream that emits `{ serverId, status, error? }` whenever a connection state changes. The settings page subscribes while open.

## Frontend changes

### Drop the in-browser orchestrator

`src/taskpane/agent/orchestrator.ts` is deleted. The agent loop runs on the server. The browser owns:

- The chat UI (Fluent UI, message rendering, parts rendering).
- The iframe sandbox (`executor/sandbox.ts`, unchanged).
- The `onToolCall` handler that runs `execute_code` against the iframe.
- The settings UI, talking to `/api/*`.

### `useChat` wiring

```ts
const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status } = useChat({
  id: conversationId,
  messages: initialMessages,                  // loaded from /api/conversations/:id
  transport: new DefaultChatTransport({
    api: '/api/chat',
    headers: { Authorization: `Bearer ${token}` },
    prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => ({
      body: {
        id,
        host,
        providerId,
        modelId,
        trigger,
        ...(trigger === 'submit-user-message'
          ? { message: messages[messages.length - 1] }
          : { messageId }),
      },
    }),
  }),
  sendAutomaticallyWhen: (msgs) =>
    lastAssistantMessageIsCompleteWithToolCalls(msgs) ||
    lastAssistantMessageIsCompleteWithApprovalResponses(msgs),
  async onToolCall({ toolCall }) {
    if (toolCall.dynamic) return;
    if (toolCall.toolName === 'execute_code' && settings.autoApprove) {
      const result = await runInIframe(toolCall.input.code);
      addToolOutput({ tool: 'execute_code', toolCallId: toolCall.toolCallId, output: result });
    }
    // If autoApprove is false, the part stays in `input-available` state.
    // The MessageBubble renders Approve/Reject buttons that call
    // runInIframe + addToolOutput, or addToolOutput with output-error on reject.
  },
});
```

### Rendering parts

The renderer in `MessageBubble.tsx` handles:

- `text` — markdown via existing pipeline.
- `step-start` — horizontal rule between tool rounds.
- `tool-execute_code` — code preview (Shiki highlight) + Approve/Reject if auto-approve is off and state is `input-available`; result rendering when `output-available` or `output-error`.
- `tool-lookup_skill` — small "Looked up: tables" pill on `output-available`; collapsed by default.
- `tool-<mcpToolName>` (statically-known MCP tools) — input/output JSON, with Approve/Reject if `state === 'approval-requested'` (server-driven via `needsApproval`); calls `addToolApprovalResponse({ id: part.approval.id, approved })`.
- `dynamic-tool` — generic input/output JSON for MCP tools whose schemas are not statically known on the client. Approve/Reject identical to above when in approval-requested state.

### Conversation reload — no strict schema validation

We deliberately **do not** call `validateUIMessages` on load. Strict validation against the *current* tool registry would reject messages whenever the user toggles a policy or removes an MCP server, even though the persisted message itself is perfectly fine. Conversations must remain readable across all those edits.

This works because the persisted `UIMessage` parts are self-contained — each part has the data it needs to render (tool name, input JSON, output JSON, state). The renderer never consults the live tool registry:

1. **Load:** `GET /api/conversations/:id` returns the raw `UIMessage[]` JSON straight from SQLite. The frontend passes it into `useChat({ messages })` untouched.
2. **Renderer.** MCP tool calls are emitted by the AI SDK as `dynamic-tool` parts (the client doesn't know MCP tool names statically anyway), so they render the same way whether the MCP server is still configured or has been removed — full fidelity, same UI as when the message was first produced. Built-in tools (`execute_code`, `lookup_skill`) live in the codebase permanently, so their typed renderers always exist.
3. **Continuation safety.** When the server reconstructs history for the next `streamText` call, it sweeps for orphan tool calls — a tool-call part with no matching tool-result part (e.g. the server crashed mid-tool, the user removed the MCP server while a call was pending, or the previous turn was aborted). Each orphan gets a synthetic `{ output: { error: 'Tool result was not recorded' } }` injected before `convertToModelMessages(history)` runs, so the SDK never chokes on a dangling call.
4. **Forward-compat guard.** The parts switch has a default branch that returns `null` for any future AI SDK part type we haven't implemented yet, so a newer SDK can never crash the renderer. Not a fallback for "missing tools" — that case doesn't exist — just a future-proofing safety net.

### Legacy data import

On first launch after upgrade, the SPA detects `localStorage`/`roamingSettings` AutoOffice keys, shows a one-click migration modal that POSTs to `/api/import-legacy`, and then clears the old storage. Skippable.

## Data model (SQLite, `bun:sqlite`)

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL
);

CREATE TABLE provider_configs (
  id TEXT PRIMARY KEY,                      -- ulid
  kind TEXT NOT NULL,                       -- 'anthropic' | 'openai' | 'claude-code' | …
  label TEXT NOT NULL,
  config JSON NOT NULL,                     -- non-secret fields
  encrypted_key BLOB,                       -- DPAPI-wrapped, NULL for CLI bridges
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  transport TEXT NOT NULL,                  -- 'stdio' | 'sse' | 'streamable-http'
  command TEXT,                             -- stdio
  args JSON,
  cwd TEXT,
  env JSON,
  url TEXT,                                 -- sse | streamable-http
  headers JSON,
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  default_policy TEXT NOT NULL DEFAULT 'ask',  -- 'allow' | 'ask' | 'deny'
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE mcp_tool_policies (
  server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  policy TEXT NOT NULL,                     -- 'allow' | 'ask' | 'deny'
  PRIMARY KEY (server_id, tool_name)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  host TEXT NOT NULL,                       -- 'word' | 'excel' | 'powerpoint'
  provider_id TEXT,
  model_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,                      -- AI-SDK-generated ('msg_…')
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  parts JSON NOT NULL,                      -- UIMessage.parts
  metadata JSON,
  created_at INTEGER NOT NULL
);

CREATE INDEX messages_conv_idx ON messages(conversation_id, created_at);
```

### Secrets at rest

Provider API keys are wrapped at write-time using Windows DPAPI (`CryptProtectData` with `CRYPTPROTECT_LOCAL_MACHINE` *off* — bound to current user). A stolen `app.db` file alone cannot reveal keys; the attacker would also need to be the same Windows user. The wrapper is a tiny FFI call from bun (`bun:ffi` over `crypt32.dll`).

## Providers (server-side)

All current AI SDK providers (Anthropic, OpenAI, Google, Groq, xAI, DeepSeek, Vercel Gateway, OpenRouter, Ollama, OpenAI-Compatible) move from `apps/web/src/taskpane/agent/providers.ts` to `apps/server/src/providers/index.ts`. The factory accepts a `ProviderConfig` record from SQLite and returns a `LanguageModel`.

New CLI-bridge providers, lazily added:

- `claude-code` — wraps `ai-sdk-provider-claude-code`; spawns the user's installed `claude` binary; auth via the user's Claude Pro/Max subscription.
- `gemini-cli` — wraps `ai-sdk-provider-gemini-cli`; uses the user's Gemini OAuth.
- `opencode` — wraps `ai-sdk-provider-opencode-sdk`; uses the user's OpenCode auth.

Each CLI bridge has a "readiness probe" run at `GET /api/providers` time and on settings-page open: `claude --version`, `gemini --version`, etc. Status is shown as `ready` / `cli-not-found` / `cli-not-authed` with a one-line hint.

## MCP (`McpHub`)

Inspired by Cline's `McpHub` (`src/services/mcp/McpHub.ts`), simplified for our context.

### Lifecycle

- **Eager connect on add/enable.** On `POST /api/mcp/servers` or enabling a disabled one, connect immediately and stream status via the SSE event stream so the settings UI shows live progress.
- **Disconnect on disable/remove.**
- **Diff classification on update:**
  - *Requires restart:* `transport`, `command`, `args`, `cwd`, `env`, `url`, `headers`. Tear down and reconnect.
  - *Live-update only:* `timeout`, `default_policy`, per-tool policy, `disabled` toggle. Apply in place; no reconnect.
- **Auto-restart with backoff** on transport error / unexpected close: 1s, 4s, 16s, capped at 64s; reset on success.
- **Stdio stderr capture:** pipe child stderr, append to a per-server ring buffer (last 100 lines); strings matching `/error/i` also flow into `server.error` for the status badge.

### Status state machine

```
not-configured ──add──▶ connecting ──ok─▶ connected
                            │              │
                            └──fail──▶ error ◀──disconnect──┘
                                          │
                                          └──user disable──▶ disabled
                                                                │
                                                                └─enable─▶ connecting
```

`disabled` is a deliberate, sticky state stored in the DB. `error` is a transient state that auto-restarts.

### Tool list and policy enforcement

- After connect, call `mcpClient.tools()` to discover. Cache `{ name, description, inputSchema, outputSchema? }` on the in-memory server object.
- For tools never seen before, write `mcp_tool_policies` rows using `default_policy`.
- On each turn, the chat route assembles `tools` for `streamText` by merging:
  1. Built-in `lookup_skill` (server execute) and `execute_code` (client; no `execute`).
  2. For each enabled MCP server, fetch tool list and per-tool policies. Drop `deny`. Wrap others in an AI SDK `tool({ description, inputSchema, execute, needsApproval })` where `execute` proxies to `mcpClient.callTool(...)` with the per-server timeout.
- The model never sees denied tools.

### Auth (deferred)

OAuth-authenticated streamable-http MCPs are not in v1. Bearer-token / static-header auth (already supported by the AI SDK transport options) is sufficient for the common cases. Cline's `McpOAuthManager` is a v2 reference.

## Code execution flow

Unchanged in spirit, simplified in mechanism:

1. Server's `execute_code` tool is declared with only an `inputSchema` ({ code: string }) and *no* `execute`.
2. Server emits a tool-call part; the AI SDK stream surfaces it to the client as part of the assistant message.
3. Client's `onToolCall` recognizes `execute_code`:
   - If `settings.autoApprove === true`: immediately runs `runInIframe(code)` and calls `addToolOutput`.
   - Otherwise: leaves the part in `input-available` state. The message bubble renders Approve / Reject. Approve → run iframe → `addToolOutput`. Reject → `addToolOutput({ state: 'output-error', errorText: 'User rejected' })`.
4. `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` resubmits to continue the loop; the model sees the tool result and produces the next step.
5. `stopWhen: stepCountIs(20)` caps runaway loops.

Self-healing on iframe error retains current shape: the `output-error` text includes the formatted error; the model decides to retry or give up; we don't need a separate retry counter — the agent loop handles it under `stopWhen`.

## Installer (Inno Setup)

`installer/setup.iss` is extended, not rewritten. The existing Trusted Catalog logic — including the "host catalog already present, drop our manifest into it" branch that prevents Office's TrustedCatalogs parser from breaking with multiple GUID subkeys — stays as-is. We add the new pieces (bun binary, cert, token, scheduled task) on top.

- `PrivilegesRequired=admin` stays. Network share creation and (optionally) cert install to `LocalMachine\Root` need it.
- **Files added** to `[Files]`:
  - `autoOffice-server.exe` (bun-compiled) → `{app}\autoOffice-server.exe`.
  - Tray icon assets, license, README → `{app}\resources\`.
- **Trusted Catalog + manifest** — kept. The existing `ShouldCreateOwnCatalog` / host-catalog-detection / network-share logic is preserved. The shipped `manifest.xml` is updated only in that its `SourceLocation` points at `https://localhost:47318/` instead of GitHub Pages.
- **First-run init.** During `ssPostInstall`, run `autoOffice-server.exe --first-run-init` once. The binary:
  1. Generates a self-signed cert (SAN `localhost`, 10y) and writes it under `%LOCALAPPDATA%\AutoOffice\config\`.
  2. Adds the cert to the Windows trust store. Default target: `CurrentUser\Root` for the install user (silent — Windows prompts only on `LocalMachine\Root` in some configurations). Documented in the guide.
  3. Generates the per-install bearer token and writes `%LOCALAPPDATA%\AutoOffice\config\config.json`.
  4. Initializes the SQLite DB schema.
- **Scheduled Task.** Create `\AutoOffice\Service` (At log on of [user that ran installer], Run only when user logged on, no admin token at runtime). Start it once after install.
- **Uninstall** — extends the existing uninstaller:
  - Stop and remove the Scheduled Task.
  - Remove the cert from the trust store.
  - Existing manifest-removal branch stays untouched (only deletes the manifest we placed; never touches a host catalog).
  - Prompt to wipe `%LOCALAPPDATA%\AutoOffice\` (DB + config). Default: keep, so reinstall preserves chat history and provider config.

## Dev workflow

- One process serves everything in dev too:

  ```ts
  // apps/server/src/index.ts (dev path)
  const vite = await createViteServer({ server: { middlewareMode: true }, root: '../web' });
  app.use('*', honoVite(vite));   // delegates non-/api routes to Vite for HMR
  ```

- HTTPS in dev reuses the existing `office-addin-dev-certs` CA so dev stays painless and the manifest URL is stable across dev and prod.
- `bun --watch apps/server/src/index.ts` is the only command needed; `npm run sideload` works as today because the URL/port match the manifest.
- For rare cases where a contributor wants the legacy "Vite alone" workflow, `apps/web` keeps a standalone `vite.config.ts` runnable via `npm --prefix apps/web run dev`. Not on the recommended path.

## GitHub Pages migration

Replace the deployed SPA with a small marketing site under `landing/`:

- `index.html` — what AutoOffice is, comparison table (lifted from README), download button.
- `download/` — link to latest `AutoOffice-Setup.exe` GitHub release asset.
- `guide/install.md`, `guide/troubleshooting.md` — covers cert prompt, port collision, "service not running", manual restart from tray.
- `self-host/index.md` — fork-and-build instructions (rebuild the bun binary; the existing self-host story collapses into "build your own installer").

Existing GH Action that built the SPA to Pages is replaced with one that builds `landing/` (Astro or plain HTML).

## Risks and open items

- **Cert install prompt UX.** Depending on Windows version and policy, adding the cert to `CurrentUser\Root` may show a confirmation dialog. Documented in the guide; the alternative (no localhost HTTPS) is forbidden by Office manifest validation.
- **WebView2 caching.** Office WebView2 caches aggressively. Bundle assets must use content-hashed filenames (Vite does this by default) and the SPA shell must be served with `Cache-Control: no-store`. Otherwise upgrades won't take effect after re-running the installer.
- **bun + native deps.** `bun:sqlite` is built in (good), and DPAPI access via `bun:ffi` is straightforward. Avoid `better-sqlite3` (native, awkward to compile into a single binary).
- **CLI bridge stability.** The CLI-bridge AI SDK packages are young; pin versions; surface "this provider failed, fall back to direct API" guidance in the UI.
- **Lock screen / fast user switching.** Scheduled task at logon should handle both; verify on a Windows multi-user machine before release.
- **Office close mid-stream.** Mitigated by `result.consumeStream()` keeping the agent loop running on the server. Open question: if the user reopens the task pane while a turn is mid-flight, do they see the stream continue? AI SDK supports this only with resumable streams (out of scope for v1); v1 reload shows the final saved state once the turn finishes.
- **Tool list staleness.** Not actually a rendering problem — MCP tool parts are `dynamic-tool` and self-contained, so they render the same whether or not the server is still configured. The only real concern is *continuing* a conversation with dangling tool calls, which the server's orphan-call sweep handles. See "Conversation reload — no strict schema validation".

## Migration strategy

**Single big-bang cutover on a dedicated branch.** No phased rollout, no compatibility shims, no half-migrated states on `master`. The reasons:

- The browser-side architecture and the server-side architecture share almost no surface area. Trying to keep `master` shippable while the orchestrator and providers and MCP are in motion would mean writing throwaway compatibility code at every step.
- The end-state is a fundamentally different product topology (manifest URL, install model, CORS posture). There is no useful "half-migrated" version a user could run.

Workflow:

1. Cut a new long-lived branch `feat/local-fullstack`.
2. Build the whole thing on that branch — server, frontend cutover, MCP move, installer changes, landing site replacement, all of it.
3. The branch is "done" only when an end-to-end run on a clean Windows VM works: install → Word/Excel/PowerPoint task pane loads from `https://localhost:47318` → chat with Anthropic + Claude Code provider works → stdio MCP server connects and a tool is callable with all three policies → conversation persists across pane close → uninstall cleans up.
4. Merge to `master` as a single commit (or tight sequence) once the end-to-end checklist passes.

### Definition of "done and connected"

- [ ] All tests green: unit, integration, end-to-end (see Testing section below).
- [ ] Bun-compiled `autoOffice-server.exe` runs on a clean Windows 10 + 11 VM without bun installed.
- [ ] Cert + token + Scheduled Task created by installer; verified by reboot → log in → service is running → task pane opens.
- [ ] Word, Excel, PowerPoint each load the SPA from `https://localhost:47318` without certificate or sideload errors.
- [ ] A direct-API provider (Anthropic) and a CLI-bridge provider (Claude Code) both stream through the agent loop.
- [ ] A stdio MCP server (e.g. `@modelcontextprotocol/server-filesystem`) connects on add, surfaces its tools with `default_policy: ask`, and one tool can be set to `allow`, one to `ask` (approve UI works), one to `deny` (model never sees it).
- [ ] An HTTP MCP server that was CORS-blocked in the browser-only build now works.
- [ ] `execute_code` still streams into the message bubble as the model emits, executes against the live document, and self-heals on error.
- [ ] Conversation persists across task-pane close + reopen and across server restart.
- [ ] Legacy `localStorage` / `roamingSettings` data imports cleanly on first launch after upgrade.
- [ ] Uninstaller removes Scheduled Task, cert, manifest, and (with confirmation) the data folder.
- [ ] GitHub Pages serves the new landing site, not the old SPA.

## Testing

Today the project uses `vitest` + `@testing-library/react` + `jsdom`. We extend that, and add new layers for the server and end-to-end paths.

### Unit tests (`vitest`, both apps)

- `apps/server/src/**`: pure functions, schema parsing, policy filtering, McpHub diff classification, DPAPI wrap/unwrap (Windows-only test, skipped on CI Linux), provider readiness probes, SQL query helpers. `bun test` and `vitest` both work for these — we standardize on `vitest` for parity with the web app.
- `apps/web/src/**`: existing component and host-context tests carry over unchanged. Add tests for new parts renderers (`step-start`, `dynamic-tool`, approval-requested branches).
- `packages/shared/src/**`: zod schema round-trips.

**Coverage target:** 80% lines / 70% branches for `apps/server` and `packages/shared`. `apps/web` keeps its existing baseline (track but don't gate). Configured via `vitest --coverage` (V8 coverage); thresholds enforced in CI.

### Integration tests (`vitest`, `apps/server`)

- Spin up the Hono app in-process (no real network) using Hono's `app.request(...)` testing API.
- Use a fresh `bun:sqlite` `:memory:` DB per test.
- Stub providers with a fake AI SDK provider that emits a scripted UI message stream (text + tool-call + tool-result + finish).
- Stub MCP servers with an in-process MCP server that registers known tools and asserts arguments.
- Cover: full `/api/chat` round-trip with each tool-policy combination; eager connect / disable / reconnect lifecycle; settings CRUD; conversation persistence and replay; bearer-token enforcement; origin-gated `/bootstrap`; legacy import endpoint.

### End-to-end tests (`playwright`, new)

- Headed against a real `bun --watch apps/server` process bound to `127.0.0.1:47318`. Uses the dev cert (already trusted).
- Drives the SPA in a Chromium context (not Office, but exercises the full client-server protocol).
- Scripts: load chat, send message, render parts, approve/deny tool, settings → add MCP server → see tool list → toggle policy, conversation reload across page refresh.
- One scenario uses the real `claude` CLI (via the CLI-bridge provider) gated behind an env flag — runs locally before release, skipped on CI.

### Office task-pane smoke test (manual checklist)

The Office WebView2 task pane is hard to automate. We document a manual checklist, run on a clean Windows VM as part of the "done" definition above. The checklist lives at `docs/superpowers/specs/2026-05-04-local-fullstack-migration-design-smoke-checklist.md` and is updated as part of the same branch.

### CI

GitHub Actions matrix:

- **`vitest` job** on Ubuntu: unit + integration tests for `apps/server`, `apps/web`, `packages/shared`. Coverage reported, thresholds enforced.
- **`vitest` Windows job**: re-runs `apps/server` tests on `windows-latest` so DPAPI / cert / Scheduled Task helpers actually exercise their Windows paths.
- **`playwright` job** on Ubuntu (xvfb): runs the e2e scripts against a `bun` server.
- **`build` job** on Windows: runs `bun build --compile`, then runs the binary's `--smoke` flag (which performs `/health` + `GET /` + a single `/api/chat` against a stub provider) to catch packaging regressions.
- **`installer` job** on Windows: builds the Inno Setup installer, installs it on a fresh runner, runs `--smoke` again post-install, uninstalls, asserts cleanup.

The branch cannot merge until all five jobs pass.
