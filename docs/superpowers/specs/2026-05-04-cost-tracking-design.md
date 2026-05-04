# Cost Tracking Across All Providers — Design

**Date:** 2026-05-04
**Status:** Spec
**Inspired by:** `~/pdf_proofread/src/ai/pricing.ts` (single-call cost model, 2 supported models)

## Goal

Show the user how much each conversation has cost in USD, computed across **every** provider configured in the app: Anthropic, OpenAI, Google, Groq, xAI, DeepSeek, Vercel AI Gateway, and OpenAI-Compatible endpoints. Persist a running per-conversation total so it survives reloads and shows up in the history panel.

## Non-goals (YAGNI)

- Per-turn cost display (running total in the chat header is enough signal)
- Live pricing fetch from external registries (models.dev, etc.) — bundled snapshot only
- Settings toggle to hide cost
- Currency conversion or non-USD display
- Budget caps or warning thresholds
- Reasoning-token line item in the breakdown (always 0 today; reasoning is already counted in `outputTokens` and billed at the output rate)
- Cost tracking for the deferred CLI-bridge providers (Claude Code, Gemini CLI, OpenCode) — those are blocked on the server-backed migration and out of scope here

## Per-provider cost source — verified against `node_modules/@ai-sdk/*`

| Provider | USD source | Cache tokens (already normalized by AI SDK into `inputTokenDetails`) |
|---|---|---|
| `gateway` | **Exact** — `providerMetadata.gateway.cost` | passthrough |
| `anthropic` | Estimate from `PRICING` | `cache_read_input_tokens` → `cacheRead`, `cache_creation_input_tokens` → `cacheWrite` |
| `openai` | Estimate | `prompt_tokens_details.cached_tokens` → `cacheRead`; no cacheWrite |
| `google` | Estimate | `cachedContentTokenCount` → `cacheRead`; no cacheWrite |
| `groq` | Estimate | `prompt_tokens_details.cached_tokens` → `cacheRead`; no cacheWrite |
| `xai` | Estimate | `prompt_tokens_details.cached_tokens` → `cacheRead`; no cacheWrite |
| `deepseek` | Estimate | `prompt_cache_hit_tokens` → `cacheRead`; no cacheWrite |
| `openai-compatible` | **Tokens-only** (unknown remote, unknown rates) | depends on remote — passed through but USD shown as 0 with `source: 'tokens-only'` |

This means a single `computeCallCost()` function with one branch (`providerId === 'gateway'` for the exact path) handles every provider. All non-gateway providers go through the same `estimate()` codepath because the AI SDK adapters already normalize cache tokens into the standard `LanguageModelUsage.inputTokenDetails` shape.

## Architecture

Three new modules + edits to four existing ones:

```
src/taskpane/
├── agent/
│   ├── pricing.ts           [NEW]  PRICING table + computeCallCost + sumCallCosts
│   ├── pricing.test.ts      [NEW]  unit tests
│   └── orchestrator.ts      [EDIT] capture usage + emit onTurnCost callback
├── lib/
│   ├── cost.ts              [NEW]  formatUsd + formatTokens helpers
│   └── cost.test.ts         [NEW]  formatter tests
├── store/
│   ├── history.ts           [EDIT] add optional cost fields to Conversation/ConversationSummary
│   └── history.test.ts      [EDIT] cost persistence + back-compat
├── components/
│   ├── ChatPanel.tsx        [EDIT] running-total badge in header
│   ├── HistoryPanel.tsx     [EDIT] cost cell in each row
│   └── CostBadge.tsx        [NEW]  badge + breakdown popover (used by ChatPanel)
├── i18n/locales/en.json     [EDIT] new cost.* keys
└── i18n/locales/he.json     [EDIT] new cost.* keys
```

## Pricing module (`agent/pricing.ts`)

```ts
import type { LanguageModelUsage, ProviderMetadata } from 'ai';

interface ModelRates {
  /** USD per million tokens. */
  input: number;
  cachedRead: number;
  /** Cache write rate. 0 for providers that don't bill writes separately. */
  cacheWrite: number;
  output: number;
  /** If set, requests above the threshold use these alternate rates. */
  longContext?: { thresholdInputTokens: number; input: number; output: number };
}

export const PRICING: Record<string, ModelRates> = {
  // One entry per model id listed in PROVIDER_MODELS (SettingsPanel.tsx:76).
  // Rates sourced from each provider's public pricing page on the
  // implementation date; PRICING_VERSION must be bumped at the same time.
  // Shape illustrated:
  'claude-opus-4-7': { input: 5, cachedRead: 0.5, cacheWrite: 6.25, output: 25 },
  // ... all other anthropic / openai / google / groq / xai / deepseek models
};

export const PRICING_VERSION = '2026-05';

export type CostSource = 'gateway-exact' | 'estimated' | 'tokens-only';

export interface CallCost {
  inputUsd: number;
  cachedReadUsd: number;
  cacheWriteUsd: number;
  outputUsd: number;
  totalUsd: number;
  source: CostSource;
  tokens: {
    input: number;       // non-cached input tokens
    cachedRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;   // included in output count; tracked for visibility
  };
}

export function emptyCallCost(source?: CostSource): CallCost { /* zeros */ }

export interface ComputeCostArgs {
  providerId: string;
  modelId: string;
  usage: LanguageModelUsage | undefined;
  providerMetadata: ProviderMetadata | undefined;
}

export function computeCallCost(args: ComputeCostArgs): CallCost;
export function sumCallCosts(costs: CallCost[]): CallCost;
```

### `computeCallCost` logic

1. Read tokens from `usage.inputTokenDetails` (cacheRead, cacheWrite) and `usage.outputTokenDetails.reasoningTokens`. Non-cached input is `inputTokenDetails.noCacheTokens ?? usage.inputTokens ?? 0`. Same shape as pdf_proofread.
2. **Gateway exact path**: if `providerId === 'gateway'`, look up `providerMetadata?.gateway?.cost`. If it's a finite number, build a `CallCost` whose per-class breakdown is the *estimate* from rates (so the popover still has rows) but whose `totalUsd` is the exact gateway figure and `source: 'gateway-exact'`.
3. **Known model**: if `PRICING[modelId]` exists, estimate. Long-context tier kicks in when `tokens.input + cachedRead + cacheWrite > rates.longContext.thresholdInputTokens`.
4. **Unknown model** (any provider, including `openai-compatible` and any future model not yet in PRICING): return a `CallCost` with all USD = 0, tokens populated, `source: 'tokens-only'`.

### Aggregation

`sumCallCosts(costs)` sums every USD field and every token field. Source promotion rules:
- Any `'tokens-only'` in the input list → result is `'tokens-only'`.
- Else any `'estimated'` → `'estimated'`.
- Else `'gateway-exact'`.

This means a conversation that ever used an unknown model is honestly labeled tokens-only.

## Orchestrator integration (`agent/orchestrator.ts`)

Add one callback:

```ts
export interface OrchestratorCallbacks {
  // ...existing...
  onTurnCost: (cost: CallCost) => void;   // NEW
}
```

After the `for await (chunk of result.fullStream)` loop completes successfully (and `capturedStreamError` is null), `await result.totalUsage` and `await result.providerMetadata`, compute the cost, and emit:

```ts
const usage = await result.totalUsage;
const meta = await result.providerMetadata;
const cost = computeCallCost({
  providerId: settings.selectedProviderId,
  modelId: settings.selectedModel,
  usage,
  providerMetadata: meta,
});
callbacks.onTurnCost(cost);
```

`totalUsage` is the AI SDK's aggregate across **every step** in the agent loop (the initial reply plus every continuation after a `lookup_skill` / `execute_code` / MCP tool call), so a single emit per `runAgent` call is correct.

**Error path**: if the stream errored, attempt to compute cost from whatever partial usage is available; if `result.totalUsage` rejects or returns nothing, skip the emit. Tool-call failures inside the agent loop don't count as stream errors and still result in valid `totalUsage`.

## Persistence (`store/history.ts`)

```ts
interface ConversationSummary {
  // ...existing...
  totalUsd?: number;       // for HistoryPanel — avoids loading the full blob
  costSource?: CostSource; // so HistoryPanel can suppress $ when tokens-only
}

interface Conversation extends ConversationSummary {
  // ...existing...
  cost?: CallCost;         // running total across all turns
}
```

All fields are optional; old conversations load with `cost: undefined` and the UI displays "—". No `CURRENT_VERSION` bump — adding optional fields is backward-compatible with the existing `v: 1` reader (the version-refusal check only triggers for `existing.v > CURRENT_VERSION`).

## Aggregation in `App.tsx`

Stash the latest turn's cost in a local during `handleSend`:

```ts
let turnCost: CallCost | null = null;

const callbacks: OrchestratorCallbacks = {
  // ...existing...
  onTurnCost: (cost) => { turnCost = cost; },
};

// after `await runAgent(...)`:
if (turnCost) {
  const prev = (getConversation(convId)?.cost) ?? emptyCallCost('estimated');
  const next = sumCallCosts([prev, turnCost]);
  // merge into the Conversation object that App already builds for saveConversation
  conv.cost = next;
  conv.totalUsd = next.totalUsd;
  conv.costSource = next.source;
}
saveConversation(conv);
```

The summary fields (`totalUsd`, `costSource`) duplicate values from `cost` for the index. Acceptable redundancy — keeps `listConversations()` cheap (no blob reads).

## UI

### `<CostBadge>` (new component, used in chat header)

Compact form:
- **Known model with USD**: `$0.0123` (4 decimals under $1, 2 decimals at/above $1 — same rule as pdf_proofread `formatUsd`).
- **Tokens-only**: `1.2K tok` (formatted via `formatTokens`).
- **Empty**: hidden entirely.

Click → Fluent UI `Popover` containing a 4-row table:

| label                     | tokens   | USD     |
|---------------------------|----------|---------|
| Input                     | 12.4K tok | $0.0620 |
| Cached read               | 3.1K tok  | $0.0016 |
| Cache write               | 0         | (hidden when 0) |
| Output                    | 1.8K tok  | $0.0900 |
| **Total**                 |           | **$0.1536** |

Footer line under the table:
- `gateway-exact` → "Exact via Vercel AI Gateway" / "סכום מדויק דרך Vercel AI Gateway"
- `estimated`     → "Estimated · pricing v{PRICING_VERSION}" / "הערכה · מחירון v{PRICING_VERSION}"
- `tokens-only`   → "Pricing not available for this model" / "אין מחירון זמין לדגם זה"

Rows where both tokens and USD are 0 are hidden so the popover stays tight.

### `ChatPanel.tsx`

Render `<CostBadge cost={cost} />` next to the existing host badge in the header. `cost` is a new prop on `ChatPanel`, supplied by `App.tsx` from the current conversation's running total (re-read from `getConversation(activeConversationId)` after each save, or held in a piece of `App.tsx` state populated whenever `saveConversation` is called). Pick the form that matches how `App.tsx` already supplies other conversation-derived props.

### `HistoryPanel.tsx`

Append the cost to the existing meta line for each row:

```
[host badge] · 3 minutes ago · 12 messages · $0.42
```

Hidden when `summary.totalUsd` is `undefined` or `0`. When `summary.costSource === 'tokens-only'`, suppress the dollar entirely (don't show "$0.00" — that's misleading).

## i18n keys

Add to `en.json` and `he.json` under a new `cost` namespace:

```json
{
  "cost": {
    "title": "Run cost",
    "input": "Input",
    "cachedRead": "Cached read",
    "cacheWrite": "Cache write",
    "output": "Output",
    "total": "Total",
    "sourceExact": "Exact via Vercel AI Gateway",
    "sourceEstimated": "Estimated · pricing v{version}",
    "sourceTokensOnly": "Pricing not available for this model",
    "unknown": "—"
  }
}
```

Hebrew translations follow the existing tone (no labels for language metadata, natural phrasing).

## Helpers (`lib/cost.ts`)

Direct port from `pdf_proofread/src/lib/cost.ts`:

```ts
export function formatUsd(usd: number): string;     // 4 decimals under $1, 2 above
export function formatTokens(n: number): string;    // K/M suffixes
```

## Testing

### `pricing.test.ts`
- For each `PRICING` entry: synthetic `usage` with each token class (input, cachedRead, cacheWrite, output) → assert per-class USD = (tokens * rate / 1e6), total = sum.
- Long-context tier: input above `thresholdInputTokens` switches to `longContext` rates.
- Gateway-exact path: `providerId='gateway'` + `providerMetadata.gateway.cost = 0.42` → `totalUsd = 0.42`, `source = 'gateway-exact'`, breakdown rows still computed from rates.
- Tokens-only fallback: unknown `modelId` → all USD = 0, `source = 'tokens-only'`, tokens populated.
- `sumCallCosts`: summation across mixed sources promotes correctly (any `tokens-only` → `tokens-only`; else any `estimated` → `estimated`; else `gateway-exact`).
- Empty list → `emptyCallCost('estimated')`.

### `cost.test.ts`
- `formatUsd`: `0` → `$0.0000`, `0.123` → `$0.1230`, `1.5` → `$1.50`, negative, NaN/Infinity guards.
- `formatTokens`: `999` → `999`, `1500` → `1.5K`, `15_000` → `15K`, `1_500_000` → `1.50M`.

### `history.test.ts` (extension)
- Save a conversation with `cost`, reload, assert deep equality.
- Save a conversation with `cost`, then save again with an updated `cost`, assert overwrite.
- Load a v1 blob written without `cost`/`totalUsd`/`costSource` (legacy fixture) → conversation loads, fields are `undefined`.
- Index `summarize()` carries `totalUsd` and `costSource` to `ConversationSummary`.

### Orchestrator integration test
- Stub `streamText` to return `totalUsage` with known token counts and `providerMetadata` empty.
- Assert `onTurnCost` is called exactly once with the expected `CallCost`.
- Stub gateway path: `providerMetadata: { gateway: { cost: 0.42 } }` → asserted `source: 'gateway-exact'`, `totalUsd: 0.42`.
- Stub stream-error path with no `totalUsage` → assert `onTurnCost` is NOT called.

## Open question (resolved)

Q: Do we need a per-provider extractor for cache tokens?
A: **No.** Verified against `node_modules/@ai-sdk/{anthropic,openai,google,groq,xai,deepseek}/dist/index.js` that all six providers normalize cache hits into the standard `LanguageModelUsage.inputTokenDetails` shape. One `readTokens(usage)` function works universally.

## Migration / rollout

- No data migration. Existing conversations show "—" until they get a turn that produces a `CallCost`.
- No setting flag. Cost is always tracked once this ships.
- `PRICING_VERSION = '2026-05'` is the snapshot date; bump it whenever the table changes so the popover footer reflects accuracy.
