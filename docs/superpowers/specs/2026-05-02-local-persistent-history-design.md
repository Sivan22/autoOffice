# Local Persistent Chat History — Design

**Status:** Approved
**Date:** 2026-05-02

## Goal

Make AutoOffice chat conversations survive task pane reloads, and let users keep multiple named conversations and switch between them. All history is stored on the **local device** — never roamed across devices and never sent to any server.

This implements the first two items of the README's "Chat History" roadmap (persist conversation, named conversations + history panel). Export to markdown is explicitly deferred.

## Non-goals

- Export to markdown / plain text (roadmap item — separate spec).
- Cross-device sync (would defeat "local"; not what the user asked for).
- Search across conversations.
- IndexedDB / OPFS migration. Only revisit if real users hit the `localStorage` cap.

## Storage backend

`localStorage` only — in **both** dev and inside Office. `Office.context.roamingSettings` continues to hold settings only; it is not used for history. This is the user-driven "local" constraint: history is per-device.

### Keyspace

| Key | Value |
|---|---|
| `autooffice_history_index` | JSON array of `ConversationSummary` |
| `autooffice_history_conv_<id>` | JSON `Conversation` blob |

Splitting the index from per-conversation blobs keeps the cheap "list conversations" path small (one read, no payload) and lets us delete a single conversation without rewriting the rest.

## Data model

```ts
type ConversationVersion = 1;

interface ChatMessage {              // existing — re-used as-is from agent/orchestrator.ts
  role: 'user' | 'assistant';
  content: string;
  codeBlock?: { code: string; status: 'pending' | 'rejected' | 'running' | 'success' | 'error'; result?: string };
  toolActivity?: { toolName: string };
}

interface ConversationSummary {
  id: string;                        // crypto.randomUUID()
  title: string;                     // auto-derived; user-renameable
  host: HostKind;                    // 'word' | 'excel' | 'powerpoint'
  createdAt: number;                 // epoch ms
  updatedAt: number;                 // epoch ms
  messageCount: number;              // uiMessages.length
}

interface Conversation extends ConversationSummary {
  v: ConversationVersion;            // schema version, currently 1
  uiMessages: ChatMessage[];         // for visual restore (code blocks, tool activity, etc.)
  modelMessages: ModelMessage[];     // from `ai` SDK — for runAgent to continue with full context
}
```

We persist **both** `uiMessages` and `modelMessages` because they serve different consumers:

- `uiMessages` drives the visual chat (including approve/reject/error states and tool activity). Without it, restoring a thread shows a wall of plain text.
- `modelMessages` is what `runAgent` feeds to `streamText` next turn. It contains tool-call ids, tool results, and assistant tool-use blocks that the UI doesn't render but the model needs.

These are already kept in sync today (`App.tsx` updates `messages` state and `conversationHistory.current` ref in lockstep).

### Title derivation

Two-stage:

1. **Placeholder** (synchronous, on conversation creation): the first user message's content, trimmed, single-lined, truncated to 40 chars. If empty, `"New chat"`.
2. **Model-generated title** (asynchronous, after the first turn completes): non-blocking call via `generateTitle(messages, settings)` in `src/taskpane/agent/title.ts`. Uses the user's currently-configured model and provider via the existing `createModel(settings)` — no separate cheap-model setting. Single non-streaming `generateText` call with a short prompt (*"Generate a 3-6 word title for this chat. Reply with only the title, no quotes, no punctuation."*). Result is trimmed and capped at 50 chars.

**Fallback chain.** If the model call errors, returns empty, or there's no API key configured, silently keep the placeholder title. No retries, no toast.

**Race with manual rename.** When the model call resolves, before persisting we read the latest title from the index. If it no longer equals the placeholder we set, the user has renamed it manually — we **do not** overwrite. Otherwise we update both the index entry and the blob's `title` field.

**Once-only.** Title generation runs only after the first turn. Conversations that drift in topic are not auto-retitled in v1; users can rename manually from the history panel.

## UX

### Header

The chat header gains two buttons (left of the existing settings gear):

- **History** (clock-style icon): opens the history panel.
- **New chat** (plus icon): clears in-memory state and de-selects the active conversation. No row is written until the first user message is sent.

The host badge stays where it is.

### History panel

Same modal pattern as `SettingsPanel.tsx` — full-pane overlay with a close button. Contents:

- **Filter chips** at top: `Current host` (default), `All`, `Word`, `Excel`, `PowerPoint`. The default filter is "Current host" so the visible list still feels per-host even though the underlying store is shared.
- **List**, newest-first by `updatedAt`. Each row:
  - Title (click → load).
  - Host badge.
  - Relative time (e.g., "2h ago").
  - Message count.
  - Trailing icons: rename (inline edit), delete (with confirm).
- **Empty state:** "No conversations yet — start chatting to create one."

### Cross-host load behavior

If the user loads a conversation whose `host` differs from the currently-open host, show a non-blocking banner above the chat: *"This conversation was started in {Word}. You're in {Excel}. New messages will run against {Excel}'s APIs."*

We do **not** swap hosts. The orchestrator continues to use the current `HostContext` for tools, system prompt, and skill registry. This is the documented trade-off of the shared list (option B from brainstorming).

### Startup behavior

On `App` mount, call `mostRecentForHost(host.kind)`:
- If found, hydrate `messages`, `conversationHistory.current`, and `activeConversationId` from it.
- If none, start a blank new chat. No row is written until the first user message lands.

### Loading guard

While `isLoading === true` (a turn is in flight), the history panel's row click and "new chat" button are disabled. Cancelling `streamText` mid-flight is out of scope.

## Persistence triggers

Writes happen at these points:

1. **First user message of a fresh chat** → create the `Conversation`, append to index, write blob.
2. **End of any turn** (after `runAgent` returns) → debounced write (300ms) of the active conversation's blob; bump `updatedAt` and `messageCount` in the index.
3. **Rename / delete** from the history panel → immediate write.

We do **not** save mid-stream (per-token). End-of-turn is enough because that's the only point at which `runAgent` returns a coherent `ModelMessage[]`. A reload during streaming loses only the current in-flight turn, which is acceptable.

## Quota & eviction

`localStorage` is ~5 MB per origin. Code execution outputs and tool results can be chunky. Two guards:

- **Soft cap on total size.** Before each write, sum the byte length of all `autooffice_history_conv_*` keys. If over ~4 MB, evict oldest conversations by `updatedAt` until under threshold. The **active** conversation is never evicted.
- **Per-conversation truncation.** Runs inside `saveConversation`, before the blob is written. If the conversation's serialized size exceeds 1 MB, walk its `uiMessages[].codeBlock.result` strings oldest-first, replacing each with `"[truncated]"` until under 1 MB. Tool-result strings are the typical bloat source. Message structure and order are preserved.
- **`QuotaExceededError` during save.** Run eviction once and retry. If still failing, log a `console.warn` and continue in-memory only for the rest of the session. *(A user-visible toast was originally specified but deferred — Fluent UI's `useToastController` isn't wired up in this codebase yet. Tracked as a follow-up; the warn is the only signal until then.)*

Numbers (4 MB total cap, 1 MB per-conversation cap) are conservative defaults and live in one constants block in `history.ts` so they're easy to tune.

## Module layout

### New file: `src/taskpane/store/history.ts`

Pure storage layer — no React. Exported API:

```ts
function listConversations(): ConversationSummary[];                      // sorted by updatedAt desc
function getConversation(id: string): Conversation | null;
function saveConversation(c: Conversation): void;                         // upsert; updates index; runs eviction
function renameConversation(id: string, title: string): void;
function deleteConversation(id: string): void;
function mostRecentForHost(host: HostKind): ConversationSummary | null;
```

Internal helpers (not exported): `readIndex`, `writeIndex`, `readBlob(id)`, `writeBlob(c)`, `evictIfNeeded`, `truncateIfNeeded`. Schema-version handling lives here too.

### New component: `src/taskpane/components/HistoryPanel.tsx`

Mirrors `SettingsPanel.tsx`'s shell (header with close, scrollable body). Contains the filter chips and the list. Inline rename uses a controlled `Input`; delete uses a Fluent `Dialog` confirm.

### New file: `src/taskpane/agent/title.ts`

```ts
async function generateTitle(messages: ModelMessage[], settings: AppSettings): Promise<string | null>;
```

Uses `createModel(settings)` and `generateText` from the AI SDK. Returns `null` on any failure (caller falls back to placeholder). Prompt is a single user-role message containing the conversation transcript followed by the title instruction; system prompt is omitted to keep the call cheap.

### Existing files modified

- `src/taskpane/App.tsx`
  - State: add `activeConversationId: string | null`, `showHistory: boolean`.
  - On mount: hydrate from `mostRecentForHost(host.kind)`.
  - In `handleSend`: if `activeConversationId` is null, generate one + create the conversation on first user message (with placeholder title).
  - After `runAgent` returns: debounced `saveConversation(...)` with the latest `messages` + `history`. If this was the **first** turn, also fire-and-forget `generateTitle(...)`; on resolve, run the rename-race check (see Title derivation) and persist if safe.
  - Add handlers `handleNewChat`, `handleLoadConversation(id)`, `handleRename(id, title)`, `handleDelete(id)`.
  - Render `HistoryPanel` overlay when `showHistory`.

- `src/taskpane/components/ChatPanel.tsx`
  - Add `History` and `New chat` buttons in the header.
  - Add `onOpenHistory` and `onNewChat` props.
  - Render the cross-host banner when a loaded conversation's host differs from the current host. Banner visibility is owned by `App` and passed to `ChatPanel` as a prop; the banner element itself lives inside `ChatPanel`.

- `src/taskpane/store/settings.ts` — **untouched**.

## Error & edge handling

- **Corrupted blob** (JSON parse fails on load): log a console warning, treat as missing for the current session, do **not** clobber. The user's data is recoverable from devtools.
- **Unknown schema version** (`v` not in {1}): allow read (so the user can still see the data); `saveConversation` on it is a no-op that logs a warning. Future migrations live in `history.ts`.
- **Concurrent tabs.** Two task panes for the same Office user can't really coexist in practice (the add-in is single-instance per host window), but `localStorage` is shared per origin. We do not solve cross-tab sync; last write wins is acceptable.
- **Race: load while `isLoading`.** UI prevents this. If somehow it happens (programmatic), we ignore the load and log.

## Testing

### Unit tests (vitest, against a mocked `localStorage`)

- `saveConversation` round-trips via `getConversation`.
- Index stays sorted by `updatedAt` desc after multiple saves.
- `deleteConversation` removes both the blob and the index entry.
- `renameConversation` updates the index and the blob's title.
- Eviction: fill past 4 MB; verify oldest non-active conversation is dropped.
- Per-conversation truncation: build a conversation with a >1 MB tool result; verify oldest output is replaced with `"[truncated]"`.
- `QuotaExceededError`: mock `setItem` to throw once; verify retry succeeds after eviction; mock to throw twice; verify it surfaces an error path without crashing.
- Unknown `v`: `getConversation` returns the blob; `saveConversation` is a no-op and logs.

### Manual smoke tests

1. Send a message, reload the task pane → conversation restores with code blocks intact (success/error/rejected states all visible).
2. Open History panel → list shows the conversation. Rename it → title updates in-place.
3. Start a new chat, send a different message → both conversations appear.
4. Switch host (sideload Excel after using Word) → default filter is "Current host" and shows only the Excel chat. Switch filter to "All" → both visible. Click the Word chat → cross-host banner appears.
5. Delete a conversation → row disappears; reload → still gone.
6. Fill localStorage near the cap (test helper) → oldest non-active conversation is evicted on next save without crashing.
7. Send the first message with a valid API key → after the assistant responds, the title in the index swaps from the truncated first message to a model-generated title within a few seconds. Rename the conversation before the call resolves → the manual title is preserved (no overwrite). With no API key set, the placeholder title sticks silently.

## Open questions

None. All design questions resolved during brainstorming:

- **Scope:** multi-conversation (option B). Export deferred.
- **Per-host model:** shared list with host tag (option B), default filter "current host".
- **Backend:** localStorage in all environments.

## Implementation plan

A separate plan document (under `docs/superpowers/plans/`) will sequence the work into independent steps suitable for review checkpoints.
