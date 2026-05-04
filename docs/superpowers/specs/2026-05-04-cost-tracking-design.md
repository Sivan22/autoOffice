# Cost Tracking Across All Providers — Design

**Date:** 2026-05-04
**Status:** Spec
**Inspired by:** `~/pdf_proofread/src/ai/pricing.ts` (single-call cost model, 2 supported models)

## Goal

Show the user how much each conversation has cost in USD, computed across **every** provider configured in the app: Anthropic, OpenAI, Google, Groq, xAI, DeepSeek, Vercel AI Gateway, OpenRouter, Ollama, and OpenAI-Compatible endpoints (10 providers in `agent/providers.ts`). Persist a running per-conversation total so it survives reloads and shows up in the history panel.

## Non-goals (YAGNI)

- Per-turn cost display (running total in the chat header is enough signal)
- Live pricing fetch from external registries (models.dev, etc.) — bundled snapshot only
- Settings toggle to hide cost
- Currency conversion or non-USD display
- Budget caps or warning thresholds
- Reasoning-token line item in the breakdown (always 0 today; reasoning is already counted in `outputTokens` and billed at the output rate)
- Cost tracking for the deferred CLI-bridge providers (Claude Code, Gemini CLI, OpenCode) — those are blocked on the server-backed migration and out of scope here

## Per-provider cost source — verified against `node_modules/@ai-sdk/*` and `node_modules/@openrouter/ai-sdk-provider`

| Provider | USD source | Cache tokens (normalized by adapter into `inputTokenDetails`) |
|---|---|---|
| `gateway` | **Exact** — `providerMetadata.gateway.cost` (Vercel server adds it) | passthrough |
| `openrouter` | **Exact** — `providerMetadata.openrouter.usage.cost` (requires `usage: { include: true }` setting on the model factory) | OpenRouter fields normalized + duplicated in `providerMetadata.openrouter.usage` |
| `anthropic` | Estimate from `PRICING` | `cache_read_input_tokens` → `cacheRead`, `cache_creation_input_tokens` → `cacheWrite` |
| `openai` | Estimate | `prompt_tokens_details.cached_tokens` → `cacheRead`; no cacheWrite |
| `google` | Estimate | `cachedContentTokenCount` → `cacheRead`; no cacheWrite |
| `groq` | Estimate | `prompt_tokens_details.cached_tokens` → `cacheRead`; no cacheWrite |
| `xai` | Estimate (chat); xAI image/video models expose `costInUsdTicks` but we don't use them | `prompt_tokens_details.cached_tokens` → `cacheRead`; no cacheWrite |
| `deepseek` | Estimate | `prompt_cache_hit_tokens` → `cacheRead`; no cacheWrite |
| `ollama` | **Tokens-only** (local, no $) — but display USD as `$0.00` is also acceptable; spec uses tokens-only | depends on Ollama version |
| `openai-compatible` | **Tokens-only** (unknown remote, unknown rates) | depends on remote |

`computeCallCost()` has two exact-USD branches (`gateway`, `openrouter`); everything else falls through to the same `estimate()` codepath because the AI SDK adapters normalize cache tokens into the standard `LanguageModelUsage.inputTokenDetails` shape. Ollama and openai-compatible take the tokens-only fallback because we don't know rates.

### OpenRouter opt-in

`agent/providers.ts` must enable usage accounting on the OpenRouter factory:

```ts
case 'openrouter': {
  const openrouter = createOpenRouter({
    apiKey: provider.apiKey,
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
  });
  return openrouter(settings.selectedModel, { usage: { include: true } });
}
```

Without this setting, `providerMetadata.openrouter.usage.cost` is undefined and we'd silently fall back to the estimate path with no PRICING entry → tokens-only. The opt-in is free (no extra request fields beyond a small JSON flag) and OpenRouter has no documented downside.

## Architecture

Three new modules + edits to four existing ones:

```
src/taskpane/
├── agent/
│   ├── pricing.ts           [NEW]  PRICING table + computeCallCost + sumCallCosts
│   ├── pricing.test.ts      [NEW]  unit tests
│   ├── orchestrator.ts      [EDIT] capture usage + emit onTurnCost callback
│   └── providers.ts         [EDIT] enable usage:{include:true} on OpenRouter factory
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

export type CostSource = 'gateway-exact' | 'openrouter-exact' | 'estimated' | 'tokens-only';

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
3. **OpenRouter exact path**: if `providerId === 'openrouter'`, look up `providerMetadata?.openrouter?.usage?.cost`. If it's a finite number, same treatment as gateway: per-class breakdown estimated, `totalUsd` overridden, `source: 'openrouter-exact'`. Tokens come from the standard `usage.inputTokenDetails` since the OpenRouter adapter normalizes them.
4. **Known model**: if `PRICING[modelId]` exists, estimate. Long-context tier kicks in when `tokens.input + cachedRead + cacheWrite > rates.longContext.thresholdInputTokens`.
5. **Unknown model** (`ollama`, `openai-compatible`, OpenRouter without the opt-in, or any future model not yet in PRICING): return a `CallCost` with all USD = 0, tokens populated, `source: 'tokens-only'`.

### Aggregation

`sumCallCosts(costs)` sums every USD field and every token field. Source promotion rules (worst case wins, so a mixed-source conversation is honestly labeled):
1. Any `'tokens-only'` → `'tokens-only'`.
2. Else any `'estimated'` → `'estimated'`.
3. Else if all costs share the same exact source (`'gateway-exact'` or `'openrouter-exact'`) → that source.
4. Else (mixed exact sources, e.g. user switched providers mid-conversation) → `'estimated'` — we can't claim "exact via X" if half the conversation went through Y.

## Orchestrator integration (`agent/orchestrator.ts`)

Add one callback:

```ts
export interface OrchestratorCallbacks {
  // ...existing...
  onTurnCost: (cost: CallCost) => void;   // NEW
}
```

After the `for await (chunk of result.fullStream)` loop completes successfully (and `capturedStreamError` is null), `await result.steps` and compute a `CallCost` for **each step**, then sum them:

```ts
const steps = await result.steps;
const stepCosts = steps.map(step => computeCallCost({
  providerId: settings.selectedProviderId,
  modelId: settings.selectedModel,
  usage: step.usage,
  providerMetadata: step.providerMetadata,
}));
const cost = sumCallCosts(stepCosts);
callbacks.onTurnCost(cost);
```

**Why per-step, not `result.totalUsage`/`result.providerMetadata`:** `result.totalUsage` aggregates token usage across all steps, but `result.providerMetadata` exposes only the **last step's** metadata. For a typical agent turn (initial reply → `execute_code` tool call → continuation), the gateway/openrouter cost from the first step would be silently dropped if we used `result.providerMetadata`. Summing per-step `CallCost`s preserves exact-cost data from every step. For the `estimated` path the answer is identical to computing once on totals because rates are linear.

**Error path**: if the stream errored (`capturedStreamError` set), attempt `await result.steps` inside a try/catch; if it rejects, skip the emit. Tool-call failures inside the agent loop don't count as stream errors and still yield valid steps. If `steps` resolves to an empty array, emit `emptyCallCost('estimated')` so the UI still updates the badge to show the conversation has been touched.

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
- `gateway-exact`    → "Exact via Vercel AI Gateway" / "סכום מדויק דרך Vercel AI Gateway"
- `openrouter-exact` → "Exact via OpenRouter" / "סכום מדויק דרך OpenRouter"
- `estimated`        → "Estimated · pricing v{PRICING_VERSION}" / "הערכה · מחירון v{PRICING_VERSION}"
- `tokens-only`      → "Pricing not available for this model" / "אין מחירון זמין לדגם זה"

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
    "sourceGatewayExact": "Exact via Vercel AI Gateway",
    "sourceOpenRouterExact": "Exact via OpenRouter",
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
- OpenRouter-exact path: `providerId='openrouter'` + `providerMetadata.openrouter.usage.cost = 0.0123` → `totalUsd = 0.0123`, `source = 'openrouter-exact'`.
- OpenRouter without usage accounting (`providerMetadata.openrouter` undefined) and unknown model → `source = 'tokens-only'`.
- Tokens-only fallback: unknown `modelId` → all USD = 0, `source = 'tokens-only'`, tokens populated.
- `sumCallCosts`: summation across mixed sources — `tokens-only` dominates; mixed exact sources demotes to `estimated`; uniform exact source preserved.
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
- Stub `streamText` to return `steps` with one step (known token counts, empty providerMetadata) → assert `onTurnCost` called once with the expected `CallCost`.
- Multi-step gateway path: stub two steps each with `providerMetadata: { gateway: { cost: 0.20 } }` → assert emitted `totalUsd === 0.40`, `source === 'gateway-exact'` (per-step costs summed, not last-step-only).
- Multi-step OpenRouter path: stub two steps with `providerMetadata: { openrouter: { usage: { cost: 0.05 } } }` → assert summed.
- Stub stream-error path where `result.steps` rejects → assert `onTurnCost` is NOT called.
- Stub stream-error path where `result.steps` resolves to `[]` → assert `onTurnCost` called once with `emptyCallCost('estimated')`.

## Open questions (resolved)

**Q: Do we need a per-provider extractor for cache tokens?**
A: **No.** Verified against `node_modules/@ai-sdk/{anthropic,openai,google,groq,xai,deepseek}/dist/index.js` and `@openrouter/ai-sdk-provider` that all providers normalize cache hits into the standard `LanguageModelUsage.inputTokenDetails` shape. One `readTokens(usage)` function works universally.

**Q: Which providers expose per-call USD in `providerMetadata`?**
A: Two — Vercel AI Gateway (`providerMetadata.gateway.cost`, server-added) and OpenRouter (`providerMetadata.openrouter.usage.cost`, requires opting in to usage accounting). All other chat providers in our list expose only token counts. (xAI's image and video models surface `costInUsdTicks` in `providerMetadata.xai`, but we don't use them.)

## Migration / rollout

- No data migration. Existing conversations show "—" until they get a turn that produces a `CallCost`.
- No setting flag. Cost is always tracked once this ships.
- `PRICING_VERSION = '2026-05'` is the snapshot date; bump it whenever the table changes so the popover footer reflects accuracy.
