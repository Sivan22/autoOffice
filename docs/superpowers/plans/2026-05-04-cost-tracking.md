# Cost Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a per-conversation USD running total in the chat header and history list, computed across every provider in `agent/providers.ts` (Anthropic, OpenAI, Google, Groq, xAI, DeepSeek, Vercel AI Gateway, OpenRouter, Ollama, OpenAI-Compatible). Use exact USD when the provider returns it (gateway, openrouter); otherwise estimate from a bundled rate table; otherwise show tokens-only.

**Architecture:** A pure `pricing` module computes a `CallCost` per AI SDK call from `LanguageModelUsage` + `ProviderMetadata`. Orchestrator iterates `result.steps` after the stream loop, computes per-step costs, sums them, and emits via a new `onTurnCost` callback. `App.tsx` accumulates per-turn costs into a `cost: CallCost` field on the persisted `Conversation`. UI renders a Fluent UI badge + popover in the chat header and a `$` cell in history rows.

**Tech Stack:** TypeScript, React, Vitest, Vercel AI SDK (`ai`, `@ai-sdk/*`, `@openrouter/ai-sdk-provider`), Fluent UI v9, i18next.

**Spec:** `docs/superpowers/specs/2026-05-04-cost-tracking-design.md`

---

## Pre-flight

Run once before starting. These commands establish a clean baseline so you can detect regressions caused by your changes versus pre-existing failures.

- [ ] **Step 0.1: Verify clean baseline**

```bash
cd /root/autoOffice
git status
npm test
```

Expected: working tree clean (or only the spec/plan committed); all tests pass.

- [ ] **Step 0.2: Confirm i18n generator works**

```bash
npm run gen:i18n
git status
```

Expected: `keys.generated.ts` regenerates without diff. If there's a diff, commit it under `i18n: regenerate keys` before proceeding (it means an upstream change wasn't regenerated).

---

## Task 1: Format helpers (`lib/cost.ts`)

Pure stateless functions, no React, no AI SDK. Direct port of `~/pdf_proofread/src/lib/cost.ts`. Test-first.

**Files:**
- Create: `src/taskpane/lib/cost.ts`
- Create: `src/taskpane/lib/cost.test.ts`

- [ ] **Step 1.1: Create `lib/` directory**

```bash
mkdir -p /root/autoOffice/src/taskpane/lib
```

- [ ] **Step 1.2: Write the failing tests**

Create `src/taskpane/lib/cost.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatTokens, formatUsd } from './cost.ts';

describe('formatUsd', () => {
  it('uses 4 fractional digits below $1', () => {
    expect(formatUsd(0)).toBe('$0.0000');
    expect(formatUsd(0.123)).toBe('$0.1230');
    expect(formatUsd(0.99999)).toBe('$1.0000');
  });

  it('uses 2 fractional digits at or above $1', () => {
    expect(formatUsd(1)).toBe('$1.00');
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd(123.456)).toBe('$123.46');
  });

  it('handles negative amounts symmetrically', () => {
    expect(formatUsd(-0.5)).toBe('$-0.5000');
    expect(formatUsd(-5)).toBe('$-5.00');
  });

  it('returns $0.00 for non-finite values', () => {
    expect(formatUsd(Number.NaN)).toBe('$0.00');
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('$0.00');
    expect(formatUsd(Number.NEGATIVE_INFINITY)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('shows raw count under 1000', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
  });

  it('uses K with one decimal under 10K, no decimals under 1M', () => {
    expect(formatTokens(1000)).toBe('1.0K');
    expect(formatTokens(1500)).toBe('1.5K');
    expect(formatTokens(9999)).toBe('10.0K');
    expect(formatTokens(15_000)).toBe('15K');
    expect(formatTokens(999_999)).toBe('1000K');
  });

  it('uses M with two decimals at and above 1M', () => {
    expect(formatTokens(1_000_000)).toBe('1.00M');
    expect(formatTokens(1_500_000)).toBe('1.50M');
  });
});
```

- [ ] **Step 1.3: Run tests, verify they fail**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/lib/cost.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 1.4: Write the implementation**

Create `src/taskpane/lib/cost.ts`:

```ts
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd)) return '$0.00';
  const abs = Math.abs(usd);
  const fractionDigits = abs >= 1 ? 2 : 4;
  return `$${usd.toFixed(fractionDigits)}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
```

- [ ] **Step 1.5: Run tests, verify all pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/lib/cost.test.ts
```

Expected: PASS — all 7 tests.

- [ ] **Step 1.6: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/lib/cost.ts src/taskpane/lib/cost.test.ts
git commit -m "$(cat <<'EOF'
cost: add formatUsd and formatTokens helpers

Pure formatters for the cost UI. 4 decimals under $1, 2 above; K/M
suffixes for tokens with adaptive precision.
EOF
)"
```

---

## Task 2: Pricing types and PRICING table (`agent/pricing.ts` — types only, no logic yet)

Establish the type surface and PRICING data first. Logic comes in later tasks. This keeps each task small and reviewable.

**Files:**
- Create: `src/taskpane/agent/pricing.ts`

- [ ] **Step 2.1: Write the module skeleton with PRICING table**

Create `src/taskpane/agent/pricing.ts`:

```ts
import type { LanguageModelUsage, ProviderMetadata } from 'ai';

interface ModelRates {
  /** USD per million tokens. */
  input: number;
  /** Cached read rate (Anthropic prompt cache, OpenAI cached tokens, Gemini implicit cache, etc.). */
  cachedRead: number;
  /** Cache write rate. 0 for providers that don't bill writes separately. */
  cacheWrite: number;
  output: number;
  /** If set, requests with input above the threshold use these alternate rates. */
  longContext?: { thresholdInputTokens: number; input: number; output: number };
}

/**
 * Snapshot of public list prices in USD per million tokens. Keys are model
 * ids as they appear in PROVIDER_MODELS (src/taskpane/components/SettingsPanel.tsx).
 *
 * Source: each provider's public pricing page on the PRICING_VERSION date.
 * When updating any rate, bump PRICING_VERSION below.
 */
export const PRICING: Record<string, ModelRates> = {
  // Anthropic
  'claude-opus-4-7':           { input: 5,    cachedRead: 0.5,   cacheWrite: 6.25,  output: 25 },
  'claude-opus-4-6':           { input: 5,    cachedRead: 0.5,   cacheWrite: 6.25,  output: 25 },
  'claude-sonnet-4-6':         { input: 3,    cachedRead: 0.3,   cacheWrite: 3.75,  output: 15 },
  'claude-haiku-4-5-20251001': { input: 1,    cachedRead: 0.1,   cacheWrite: 1.25,  output: 5  },

  // OpenAI
  'gpt-5.4':                   { input: 1.25, cachedRead: 0.125, cacheWrite: 0,     output: 10 },
  'gpt-5.4-pro':               { input: 15,   cachedRead: 1.5,   cacheWrite: 0,     output: 120 },
  'gpt-5.4-mini':              { input: 0.25, cachedRead: 0.025, cacheWrite: 0,     output: 2 },
  'gpt-5.4-nano':              { input: 0.05, cachedRead: 0.005, cacheWrite: 0,     output: 0.4 },
  'gpt-5.3-chat-latest':       { input: 1.25, cachedRead: 0.125, cacheWrite: 0,     output: 10 },
  'gpt-5.3-codex':             { input: 1.25, cachedRead: 0.125, cacheWrite: 0,     output: 10 },
  'gpt-5':                     { input: 1.25, cachedRead: 0.125, cacheWrite: 0,     output: 10 },
  'gpt-4o':                    { input: 2.5,  cachedRead: 1.25,  cacheWrite: 0,     output: 10 },
  'gpt-4o-mini':               { input: 0.15, cachedRead: 0.075, cacheWrite: 0,     output: 0.6 },

  // Google
  'gemini-3.1-pro-preview':         { input: 2,    cachedRead: 0.5,   cacheWrite: 0, output: 12,
                                      longContext: { thresholdInputTokens: 200_000, input: 4, output: 18 } },
  'gemini-3-flash-preview':         { input: 0.3,  cachedRead: 0.075, cacheWrite: 0, output: 2.5 },
  'gemini-3.1-flash-lite-preview':  { input: 0.1,  cachedRead: 0.025, cacheWrite: 0, output: 0.4 },
  'gemini-2.5-pro':                 { input: 1.25, cachedRead: 0.31,  cacheWrite: 0, output: 10,
                                      longContext: { thresholdInputTokens: 200_000, input: 2.5, output: 15 } },
  'gemini-2.5-flash':               { input: 0.3,  cachedRead: 0.075, cacheWrite: 0, output: 2.5 },
  'gemini-2.5-flash-lite':          { input: 0.1,  cachedRead: 0.025, cacheWrite: 0, output: 0.4 },

  // Groq
  'moonshotai/kimi-k2-instruct-0905':         { input: 1,    cachedRead: 0.5,  cacheWrite: 0, output: 3 },
  'meta-llama/llama-4-scout-17b-16e-instruct':{ input: 0.11, cachedRead: 0.05, cacheWrite: 0, output: 0.34 },
  'llama-3.3-70b-versatile':                  { input: 0.59, cachedRead: 0.3,  cacheWrite: 0, output: 0.79 },
  'llama-3.1-8b-instant':                     { input: 0.05, cachedRead: 0.02, cacheWrite: 0, output: 0.08 },
  'qwen/qwen3-32b':                           { input: 0.29, cachedRead: 0.14, cacheWrite: 0, output: 0.59 },
  'openai/gpt-oss-120b':                      { input: 0.15, cachedRead: 0.07, cacheWrite: 0, output: 0.75 },
  'openai/gpt-oss-20b':                       { input: 0.10, cachedRead: 0.05, cacheWrite: 0, output: 0.50 },

  // xAI
  'grok-4':           { input: 3,    cachedRead: 0.75, cacheWrite: 0, output: 15 },
  'grok-4-fast':      { input: 0.20, cachedRead: 0.05, cacheWrite: 0, output: 0.50 },
  'grok-code-fast-1': { input: 0.20, cachedRead: 0.02, cacheWrite: 0, output: 1.50 },
  'grok-3':           { input: 3,    cachedRead: 0.75, cacheWrite: 0, output: 15 },
  'grok-3-mini':      { input: 0.30, cachedRead: 0.075, cacheWrite: 0, output: 0.50 },

  // DeepSeek
  'deepseek-chat':     { input: 0.27, cachedRead: 0.07, cacheWrite: 0, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, cachedRead: 0.14, cacheWrite: 0, output: 2.19 },
};

export const PRICING_VERSION = '2026-05';

export type CostSource = 'gateway-exact' | 'openrouter-exact' | 'estimated' | 'tokens-only';

export interface CallCost {
  inputUsd: number;
  cachedReadUsd: number;
  cacheWriteUsd: number;
  outputUsd: number;
  /** Always 0 today: reasoning tokens are already included in outputTokens and billed at the output rate. Kept for visibility. */
  reasoningUsd: number;
  totalUsd: number;
  source: CostSource;
  tokens: {
    /** Non-cached input tokens. */
    input: number;
    cachedRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
  };
}

export function emptyCallCost(source: CostSource = 'estimated'): CallCost {
  return {
    inputUsd: 0,
    cachedReadUsd: 0,
    cacheWriteUsd: 0,
    outputUsd: 0,
    reasoningUsd: 0,
    totalUsd: 0,
    source,
    tokens: { input: 0, cachedRead: 0, cacheWrite: 0, output: 0, reasoning: 0 },
  };
}

export interface ComputeCostArgs {
  providerId: string;
  modelId: string;
  usage: LanguageModelUsage | undefined;
  providerMetadata: ProviderMetadata | undefined;
}

// Implementations land in Tasks 3-5.
export function computeCallCost(_args: ComputeCostArgs): CallCost {
  throw new Error('not yet implemented');
}

export function sumCallCosts(_costs: CallCost[]): CallCost {
  throw new Error('not yet implemented');
}
```

> **Note on rates:** the PRICING values above are best-effort starting points. Before merging, verify each rate against the provider's public pricing page (anthropic.com/pricing, openai.com/pricing, ai.google.dev/pricing, groq.com/pricing, x.ai, api-docs.deepseek.com/quick_start/pricing). Update any drift and bump `PRICING_VERSION` to today's `YYYY-MM` if you change anything.

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS — no errors. (The not-yet-implemented stubs satisfy the type signatures.)

- [ ] **Step 2.3: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/pricing.ts
git commit -m "$(cat <<'EOF'
cost: add pricing module skeleton with PRICING table

PRICING covers all 32 models in PROVIDER_MODELS across the 8 providers
that bill by token. Logic stubs (computeCallCost, sumCallCosts) land in
follow-up commits with their tests.
EOF
)"
```

---

## Task 3: `computeCallCost` — estimate path

Implement the most-used branch first. No gateway, no openrouter, no tokens-only fallback yet — just `PRICING[modelId]` → estimate.

**Files:**
- Modify: `src/taskpane/agent/pricing.ts`
- Create: `src/taskpane/agent/pricing.test.ts`

- [ ] **Step 3.1: Write failing tests for the estimate path**

Create `src/taskpane/agent/pricing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LanguageModelUsage } from 'ai';
import { computeCallCost, PRICING } from './pricing.ts';

function usage(parts: {
  input?: number; cachedRead?: number; cacheWrite?: number;
  output?: number; reasoning?: number;
}): LanguageModelUsage {
  return {
    inputTokens: (parts.input ?? 0) + (parts.cachedRead ?? 0) + (parts.cacheWrite ?? 0),
    outputTokens: parts.output ?? 0,
    totalTokens:
      (parts.input ?? 0) + (parts.cachedRead ?? 0) + (parts.cacheWrite ?? 0) + (parts.output ?? 0),
    inputTokenDetails: {
      noCacheTokens: parts.input ?? 0,
      cacheReadTokens: parts.cachedRead ?? 0,
      cacheWriteTokens: parts.cacheWrite ?? 0,
    },
    outputTokenDetails: parts.reasoning != null ? { reasoningTokens: parts.reasoning } : undefined,
  } as unknown as LanguageModelUsage;
}

describe('computeCallCost — estimate path', () => {
  it('estimates a known model from rates', () => {
    const cost = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 1_000_000, output: 500_000 }),
      providerMetadata: undefined,
    });
    expect(cost.source).toBe('estimated');
    // 1M input @ $5 + 0.5M output @ $25 = $5 + $12.5 = $17.5
    expect(cost.inputUsd).toBeCloseTo(5, 6);
    expect(cost.outputUsd).toBeCloseTo(12.5, 6);
    expect(cost.totalUsd).toBeCloseTo(17.5, 6);
  });

  it('charges cache reads at the cachedRead rate', () => {
    const cost = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ cachedRead: 1_000_000 }),
      providerMetadata: undefined,
    });
    expect(cost.cachedReadUsd).toBeCloseTo(0.5, 6);
    expect(cost.totalUsd).toBeCloseTo(0.5, 6);
  });

  it('charges cache writes at the cacheWrite rate (Anthropic)', () => {
    const cost = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ cacheWrite: 1_000_000 }),
      providerMetadata: undefined,
    });
    expect(cost.cacheWriteUsd).toBeCloseTo(6.25, 6);
  });

  it('uses long-context tier when input exceeds threshold (Gemini 3.1 Pro)', () => {
    const cost = computeCallCost({
      providerId: 'google',
      modelId: 'gemini-3.1-pro-preview',
      usage: usage({ input: 250_000, output: 10_000 }),
      providerMetadata: undefined,
    });
    // 250K > 200K threshold → input rate $4, output rate $18
    expect(cost.inputUsd).toBeCloseTo((250_000 * 4) / 1_000_000, 6);
    expect(cost.outputUsd).toBeCloseTo((10_000 * 18) / 1_000_000, 6);
  });

  it('does NOT use long-context tier when input is at or below threshold', () => {
    const cost = computeCallCost({
      providerId: 'google',
      modelId: 'gemini-3.1-pro-preview',
      usage: usage({ input: 200_000, output: 10_000 }),
      providerMetadata: undefined,
    });
    expect(cost.inputUsd).toBeCloseTo((200_000 * 2) / 1_000_000, 6);
    expect(cost.outputUsd).toBeCloseTo((10_000 * 12) / 1_000_000, 6);
  });

  it('populates token counts on the result', () => {
    const cost = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 100, cachedRead: 50, cacheWrite: 25, output: 200, reasoning: 75 }),
      providerMetadata: undefined,
    });
    expect(cost.tokens).toEqual({
      input: 100, cachedRead: 50, cacheWrite: 25, output: 200, reasoning: 75,
    });
  });

  it('every PRICING entry estimates without throwing', () => {
    for (const modelId of Object.keys(PRICING)) {
      const cost = computeCallCost({
        providerId: 'anthropic',
        modelId,
        usage: usage({ input: 1000, output: 500 }),
        providerMetadata: undefined,
      });
      expect(cost.source).toBe('estimated');
      expect(cost.totalUsd).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 3.2: Run tests, verify they fail**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: FAIL — `not yet implemented`.

- [ ] **Step 3.3: Implement the estimate path**

Replace the stub `computeCallCost` in `src/taskpane/agent/pricing.ts` with:

```ts
export function computeCallCost(args: ComputeCostArgs): CallCost {
  const tokens = readTokens(args.usage);
  const rates = PRICING[args.modelId];
  if (rates) {
    return estimate(rates, tokens, 'estimated');
  }
  // Tokens-only fallback comes in Task 5.
  throw new Error('not yet implemented');
}

function readTokens(usage: LanguageModelUsage | undefined): CallCost['tokens'] {
  if (!usage) return { input: 0, cachedRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };
  const details = usage.inputTokenDetails;
  const input = details?.noCacheTokens ?? usage.inputTokens ?? 0;
  const cachedRead = details?.cacheReadTokens ?? 0;
  const cacheWrite = details?.cacheWriteTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const reasoning = usage.outputTokenDetails?.reasoningTokens ?? 0;
  return { input, cachedRead, cacheWrite, output, reasoning };
}

function estimate(rates: ModelRates, tokens: CallCost['tokens'], source: CostSource): CallCost {
  const inputTotal = tokens.input + tokens.cachedRead + tokens.cacheWrite;
  const useLong =
    !!rates.longContext && inputTotal > rates.longContext.thresholdInputTokens;
  const inputRate = useLong ? rates.longContext!.input : rates.input;
  const outputRate = useLong ? rates.longContext!.output : rates.output;

  const inputUsd = (tokens.input * inputRate) / 1_000_000;
  const cachedReadUsd = (tokens.cachedRead * rates.cachedRead) / 1_000_000;
  const cacheWriteUsd = (tokens.cacheWrite * rates.cacheWrite) / 1_000_000;
  const outputUsd = (tokens.output * outputRate) / 1_000_000;
  const totalUsd = inputUsd + cachedReadUsd + cacheWriteUsd + outputUsd;
  return {
    inputUsd,
    cachedReadUsd,
    cacheWriteUsd,
    outputUsd,
    reasoningUsd: 0,
    totalUsd,
    source,
    tokens,
  };
}
```

- [ ] **Step 3.4: Run tests, verify estimate-path tests pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: PASS — all 7 estimate tests.

- [ ] **Step 3.5: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/pricing.ts src/taskpane/agent/pricing.test.ts
git commit -m "$(cat <<'EOF'
cost: implement computeCallCost estimate path

Estimates from PRICING using the linear per-million rate model. Long-
context tier kicks in when total input tokens exceed the threshold.
Cache read/write are billed separately when the provider distinguishes
them; reasoning tokens are already counted in output and billed at the
output rate.
EOF
)"
```

---

## Task 4: `computeCallCost` — gateway and openrouter exact paths

Add the two exact-USD branches that read from `providerMetadata`.

**Files:**
- Modify: `src/taskpane/agent/pricing.ts`
- Modify: `src/taskpane/agent/pricing.test.ts`

- [ ] **Step 4.1: Add failing tests for the exact-cost paths**

Append to `src/taskpane/agent/pricing.test.ts`:

```ts
describe('computeCallCost — gateway exact path', () => {
  it('uses gateway.cost when providerId is gateway', () => {
    const cost = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 1000, output: 500 }),
      providerMetadata: { gateway: { cost: 0.42 } },
    });
    expect(cost.source).toBe('gateway-exact');
    expect(cost.totalUsd).toBe(0.42);
    // breakdown rows still computed from rates so the popover has data
    expect(cost.inputUsd).toBeGreaterThan(0);
    expect(cost.outputUsd).toBeGreaterThan(0);
  });

  it('falls back to estimate when providerId is gateway but cost is missing', () => {
    const cost = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 1000, output: 500 }),
      providerMetadata: { gateway: {} },
    });
    expect(cost.source).toBe('estimated');
  });

  it('falls back to estimate when providerId is gateway but providerMetadata is undefined', () => {
    const cost = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 1000, output: 500 }),
      providerMetadata: undefined,
    });
    expect(cost.source).toBe('estimated');
  });
});

describe('computeCallCost — openrouter exact path', () => {
  it('uses openrouter.usage.cost when providerId is openrouter', () => {
    const cost = computeCallCost({
      providerId: 'openrouter',
      modelId: 'anthropic/claude-opus-4-7',
      usage: usage({ input: 1000, output: 500 }),
      providerMetadata: { openrouter: { usage: { cost: 0.0123 } } },
    });
    expect(cost.source).toBe('openrouter-exact');
    expect(cost.totalUsd).toBe(0.0123);
  });

  it('ignores non-finite openrouter cost', () => {
    const cost = computeCallCost({
      providerId: 'openrouter',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 1000, output: 500 }),
      providerMetadata: { openrouter: { usage: { cost: Number.NaN } } },
    });
    // Falls through to estimate (which works because the modelId happens to be in PRICING).
    expect(cost.source).toBe('estimated');
  });
});
```

- [ ] **Step 4.2: Run tests, verify the new ones fail**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: FAIL on the 5 new tests; existing 7 still pass.

- [ ] **Step 4.3: Implement the exact-cost branches**

Replace the body of `computeCallCost` in `src/taskpane/agent/pricing.ts`:

```ts
export function computeCallCost(args: ComputeCostArgs): CallCost {
  const tokens = readTokens(args.usage);
  const rates = PRICING[args.modelId];

  if (args.providerId === 'gateway') {
    const exact = readGatewayCost(args.providerMetadata);
    if (exact !== null) {
      const base = rates ? estimate(rates, tokens, 'gateway-exact') : { ...emptyCallCost('gateway-exact'), tokens };
      return { ...base, totalUsd: exact, source: 'gateway-exact' };
    }
  }

  if (args.providerId === 'openrouter') {
    const exact = readOpenRouterCost(args.providerMetadata);
    if (exact !== null) {
      const base = rates ? estimate(rates, tokens, 'openrouter-exact') : { ...emptyCallCost('openrouter-exact'), tokens };
      return { ...base, totalUsd: exact, source: 'openrouter-exact' };
    }
  }

  if (rates) {
    return estimate(rates, tokens, 'estimated');
  }

  // Tokens-only fallback comes in Task 5.
  throw new Error('not yet implemented');
}

function readGatewayCost(meta: ProviderMetadata | undefined): number | null {
  const gateway = meta?.gateway as Record<string, unknown> | undefined;
  if (!gateway) return null;
  const raw = gateway.cost;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readOpenRouterCost(meta: ProviderMetadata | undefined): number | null {
  const openrouter = meta?.openrouter as { usage?: { cost?: unknown } } | undefined;
  const raw = openrouter?.usage?.cost;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}
```

- [ ] **Step 4.4: Run tests, verify exact-cost tests pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: PASS — 12 tests (7 estimate + 5 exact).

- [ ] **Step 4.5: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/pricing.ts src/taskpane/agent/pricing.test.ts
git commit -m "$(cat <<'EOF'
cost: add gateway and openrouter exact-USD paths

When the provider returns per-call USD in providerMetadata, prefer it
over the local estimate. Gateway uses providerMetadata.gateway.cost;
OpenRouter uses providerMetadata.openrouter.usage.cost (requires the
usage:{include:true} opt-in landing in a later task). Per-class
breakdown rows stay populated from rates so the popover still has data.
EOF
)"
```

---

## Task 5: `computeCallCost` — tokens-only fallback

The last remaining branch.

**Files:**
- Modify: `src/taskpane/agent/pricing.ts`
- Modify: `src/taskpane/agent/pricing.test.ts`

- [ ] **Step 5.1: Add failing tests for tokens-only**

Append to `src/taskpane/agent/pricing.test.ts`:

```ts
describe('computeCallCost — tokens-only fallback', () => {
  it('returns zeros and tokens-only source when modelId is not in PRICING', () => {
    const cost = computeCallCost({
      providerId: 'openai-compatible',
      modelId: 'some/unknown-model',
      usage: usage({ input: 100, output: 50 }),
      providerMetadata: undefined,
    });
    expect(cost.source).toBe('tokens-only');
    expect(cost.totalUsd).toBe(0);
    expect(cost.inputUsd).toBe(0);
    expect(cost.outputUsd).toBe(0);
    expect(cost.tokens.input).toBe(100);
    expect(cost.tokens.output).toBe(50);
  });

  it('falls back to tokens-only for ollama (no PRICING entry)', () => {
    const cost = computeCallCost({
      providerId: 'ollama',
      modelId: 'llama3',
      usage: usage({ input: 100, output: 50 }),
      providerMetadata: undefined,
    });
    expect(cost.source).toBe('tokens-only');
  });

  it('falls back to tokens-only for openrouter without usage accounting', () => {
    const cost = computeCallCost({
      providerId: 'openrouter',
      modelId: 'some-model-not-in-pricing',
      usage: usage({ input: 100, output: 50 }),
      providerMetadata: undefined,
    });
    expect(cost.source).toBe('tokens-only');
  });
});
```

- [ ] **Step 5.2: Run tests, verify the new ones fail**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: FAIL — `not yet implemented` thrown for unknown models.

- [ ] **Step 5.3: Replace the throw with the tokens-only fallback**

In `src/taskpane/agent/pricing.ts`, replace the trailing `throw new Error('not yet implemented')` in `computeCallCost` with:

```ts
  return { ...emptyCallCost('tokens-only'), tokens };
```

- [ ] **Step 5.4: Run tests, verify all pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: PASS — 15 tests.

- [ ] **Step 5.5: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/pricing.ts src/taskpane/agent/pricing.test.ts
git commit -m "$(cat <<'EOF'
cost: add tokens-only fallback for unknown models

When the modelId isn't in PRICING and there's no exact cost from
providerMetadata, return zeros with source='tokens-only'. Covers
ollama (local, no $), openai-compatible custom endpoints, openrouter
without the usage opt-in, and any future model id not yet in the table.
EOF
)"
```

---

## Task 6: `sumCallCosts` aggregation

Aggregator with the worst-case-wins source-promotion rule.

**Files:**
- Modify: `src/taskpane/agent/pricing.ts`
- Modify: `src/taskpane/agent/pricing.test.ts`

- [ ] **Step 6.1: Add failing tests for sumCallCosts**

Append to `src/taskpane/agent/pricing.test.ts`:

```ts
import { emptyCallCost, sumCallCosts } from './pricing.ts';

describe('sumCallCosts', () => {
  it('returns emptyCallCost("estimated") for an empty list', () => {
    expect(sumCallCosts([])).toEqual(emptyCallCost('estimated'));
  });

  it('sums every USD field and every token field', () => {
    const a = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 100, output: 50 }),
      providerMetadata: undefined,
    });
    const b = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 200, output: 100 }),
      providerMetadata: undefined,
    });
    const sum = sumCallCosts([a, b]);
    expect(sum.totalUsd).toBeCloseTo(a.totalUsd + b.totalUsd, 6);
    expect(sum.tokens.input).toBe(300);
    expect(sum.tokens.output).toBe(150);
  });

  it('promotes any tokens-only to tokens-only', () => {
    const tokensOnly = computeCallCost({
      providerId: 'ollama',
      modelId: 'llama3',
      usage: usage({ input: 10, output: 5 }),
      providerMetadata: undefined,
    });
    const estimated = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10, output: 5 }),
      providerMetadata: undefined,
    });
    expect(sumCallCosts([estimated, tokensOnly]).source).toBe('tokens-only');
  });

  it('promotes mixed exact sources to estimated', () => {
    const gateway = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10 }),
      providerMetadata: { gateway: { cost: 0.01 } },
    });
    const openrouter = computeCallCost({
      providerId: 'openrouter',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10 }),
      providerMetadata: { openrouter: { usage: { cost: 0.02 } } },
    });
    expect(sumCallCosts([gateway, openrouter]).source).toBe('estimated');
  });

  it('preserves a uniform exact source', () => {
    const a = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10 }),
      providerMetadata: { gateway: { cost: 0.01 } },
    });
    const b = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10 }),
      providerMetadata: { gateway: { cost: 0.02 } },
    });
    const sum = sumCallCosts([a, b]);
    expect(sum.source).toBe('gateway-exact');
    expect(sum.totalUsd).toBeCloseTo(0.03, 6);
  });

  it('promotes estimated + exact mixture to estimated', () => {
    const exact = computeCallCost({
      providerId: 'gateway',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10 }),
      providerMetadata: { gateway: { cost: 0.01 } },
    });
    const estimated = computeCallCost({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-7',
      usage: usage({ input: 10 }),
      providerMetadata: undefined,
    });
    expect(sumCallCosts([exact, estimated]).source).toBe('estimated');
  });
});
```

- [ ] **Step 6.2: Run tests, verify the new ones fail**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: FAIL — `sumCallCosts not yet implemented`.

- [ ] **Step 6.3: Implement sumCallCosts**

Replace the stub `sumCallCosts` in `src/taskpane/agent/pricing.ts`:

```ts
export function sumCallCosts(costs: CallCost[]): CallCost {
  if (costs.length === 0) return emptyCallCost('estimated');
  const out = emptyCallCost('estimated');
  let hasTokensOnly = false;
  let hasEstimated = false;
  let exactSources = new Set<CostSource>();
  for (const c of costs) {
    out.inputUsd += c.inputUsd;
    out.cachedReadUsd += c.cachedReadUsd;
    out.cacheWriteUsd += c.cacheWriteUsd;
    out.outputUsd += c.outputUsd;
    out.reasoningUsd += c.reasoningUsd;
    out.totalUsd += c.totalUsd;
    out.tokens.input += c.tokens.input;
    out.tokens.cachedRead += c.tokens.cachedRead;
    out.tokens.cacheWrite += c.tokens.cacheWrite;
    out.tokens.output += c.tokens.output;
    out.tokens.reasoning += c.tokens.reasoning;
    if (c.source === 'tokens-only') hasTokensOnly = true;
    else if (c.source === 'estimated') hasEstimated = true;
    else exactSources.add(c.source);
  }
  if (hasTokensOnly) out.source = 'tokens-only';
  else if (hasEstimated) out.source = 'estimated';
  else if (exactSources.size === 1) out.source = exactSources.values().next().value as CostSource;
  else out.source = 'estimated'; // mixed exact sources
  return out;
}
```

- [ ] **Step 6.4: Run tests, verify all pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/pricing.test.ts
```

Expected: PASS — 21 tests.

- [ ] **Step 6.5: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/pricing.ts src/taskpane/agent/pricing.test.ts
git commit -m "$(cat <<'EOF'
cost: implement sumCallCosts with worst-case-wins promotion

Tokens-only dominates everything. Estimated dominates exact. Mixed
exact sources demote to estimated since "exact via X" is dishonest if
half the conversation went through Y.
EOF
)"
```

---

## Task 7: Enable OpenRouter usage accounting

One-line change: pass `{ usage: { include: true } }` to the OpenRouter model factory so `providerMetadata.openrouter.usage.cost` shows up.

**Files:**
- Modify: `src/taskpane/agent/providers.ts:82-88`

- [ ] **Step 7.1: Edit the OpenRouter case**

Use the Edit tool on `src/taskpane/agent/providers.ts`. Replace:

```ts
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: provider.apiKey,
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      });
      return openrouter(settings.selectedModel);
    }
```

with:

```ts
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: provider.apiKey,
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      });
      // usage:{include:true} makes OpenRouter return per-call USD in
      // providerMetadata.openrouter.usage.cost. See cost-tracking spec.
      return openrouter(settings.selectedModel, { usage: { include: true } });
    }
```

- [ ] **Step 7.2: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7.3: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/providers.ts
git commit -m "$(cat <<'EOF'
cost: enable OpenRouter usage accounting

Pass usage:{include:true} to the OpenRouter model factory so per-call
USD lands in providerMetadata.openrouter.usage.cost. Without this opt-
in, the cost-tracking exact path silently falls back to estimate (or
tokens-only for unknown OpenRouter model ids).
EOF
)"
```

---

## Task 8: Orchestrator emits `onTurnCost` per turn

Capture `result.steps`, sum per-step costs, emit through a new callback. The per-step approach (not `result.totalUsage`) is required because `result.providerMetadata` only exposes the **last step's** metadata.

**Files:**
- Modify: `src/taskpane/agent/orchestrator.ts`
- Create: `src/taskpane/agent/orchestrator-cost.test.ts`

- [ ] **Step 8.1: Write failing tests for onTurnCost**

Create `src/taskpane/agent/orchestrator-cost.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from './orchestrator.ts';
import type { CallCost } from './pricing.ts';

// We mock the AI SDK's streamText so we can drive the result shape directly.
// The real module exports a function that returns a `StreamTextResult`-shaped
// object with `fullStream`, `steps`, `response`, etc.
const streamTextMock = vi.fn();

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: (...args: unknown[]) => streamTextMock(...args) };
});

vi.mock('../mcp/client.ts', () => ({
  getMcpTools: vi.fn().mockResolvedValue({ tools: {}, failures: [] }),
}));

vi.mock('./providers.ts', () => ({
  createModel: vi.fn().mockReturnValue({}),
}));

import { runAgent } from './orchestrator.ts';
import type { Sandbox } from '../executor/sandbox.ts';
import type { AppSettings } from '../store/settings.ts';

function makeSettings(providerId: string, modelId: string): AppSettings {
  return {
    selectedProviderId: providerId,
    selectedModel: modelId,
    providers: [{ id: providerId, name: providerId, apiKey: 'k' }],
    autoApprove: true,
    mcpServers: [],
    maxRetries: 3,
    executionTimeout: 30000,
  };
}

function makeStreamResult(steps: Array<{ usage: unknown; providerMetadata?: unknown }>) {
  return {
    fullStream: (async function* () {})(),
    steps: Promise.resolve(steps),
    response: Promise.resolve({ messages: [] }),
  };
}

const sandbox = { execute: vi.fn(), init: vi.fn(), destroy: vi.fn() } as unknown as Sandbox;

describe('runAgent — onTurnCost', () => {
  let costs: CallCost[];
  beforeEach(() => {
    costs = [];
    streamTextMock.mockReset();
  });

  function callbacks() {
    return {
      onMessage: () => {},
      onStreamToken: () => {},
      onUpsertCodeBlock: () => {},
      requestApproval: async () => true,
      onTurnCost: (c: CallCost) => costs.push(c),
    };
  }

  it('emits a CallCost computed by summing per-step usage', async () => {
    streamTextMock.mockReturnValue(makeStreamResult([
      {
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150,
                 inputTokenDetails: { noCacheTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 } },
        providerMetadata: undefined,
      },
      {
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300,
                 inputTokenDetails: { noCacheTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 } },
        providerMetadata: undefined,
      },
    ]));

    await runAgent('hi', [], makeSettings('anthropic', 'claude-opus-4-7'),
                   sandbox, 'word', callbacks());

    expect(costs).toHaveLength(1);
    expect(costs[0].source).toBe('estimated');
    expect(costs[0].tokens.input).toBe(300);
    expect(costs[0].tokens.output).toBe(150);
  });

  it('sums per-step gateway costs (not just the last step)', async () => {
    streamTextMock.mockReturnValue(makeStreamResult([
      { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        providerMetadata: { gateway: { cost: 0.20 } } },
      { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        providerMetadata: { gateway: { cost: 0.20 } } },
    ]));

    await runAgent('hi', [], makeSettings('gateway', 'claude-opus-4-7'),
                   sandbox, 'word', callbacks());

    expect(costs).toHaveLength(1);
    expect(costs[0].source).toBe('gateway-exact');
    expect(costs[0].totalUsd).toBeCloseTo(0.40, 6);
  });

  it('sums per-step OpenRouter costs', async () => {
    streamTextMock.mockReturnValue(makeStreamResult([
      { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        providerMetadata: { openrouter: { usage: { cost: 0.05 } } } },
      { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        providerMetadata: { openrouter: { usage: { cost: 0.05 } } } },
    ]));

    await runAgent('hi', [], makeSettings('openrouter', 'unknown/model'),
                   sandbox, 'word', callbacks());

    expect(costs).toHaveLength(1);
    expect(costs[0].source).toBe('openrouter-exact');
    expect(costs[0].totalUsd).toBeCloseTo(0.10, 6);
  });

  it('emits an empty cost when steps resolves to []', async () => {
    streamTextMock.mockReturnValue(makeStreamResult([]));
    await runAgent('hi', [], makeSettings('anthropic', 'claude-opus-4-7'),
                   sandbox, 'word', callbacks());
    expect(costs).toHaveLength(1);
    expect(costs[0].totalUsd).toBe(0);
    expect(costs[0].source).toBe('estimated');
  });

  it('does not emit when steps rejects', async () => {
    streamTextMock.mockReturnValue({
      fullStream: (async function* () {})(),
      steps: Promise.reject(new Error('boom')),
      response: Promise.resolve({ messages: [] }),
    });
    await runAgent('hi', [], makeSettings('anthropic', 'claude-opus-4-7'),
                   sandbox, 'word', callbacks());
    expect(costs).toHaveLength(0);
  });
});
```

- [ ] **Step 8.2: Run tests, verify failure**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/orchestrator-cost.test.ts
```

Expected: FAIL — `onTurnCost` not on the callbacks type, or the orchestrator doesn't call it.

- [ ] **Step 8.3: Add `onTurnCost` to the callbacks interface**

Edit `src/taskpane/agent/orchestrator.ts`. At the top of the file (after the `import { extractPartialStringField }` line), add:

```ts
import { computeCallCost, sumCallCosts, emptyCallCost, type CallCost } from './pricing.ts';
```

Then in `OrchestratorCallbacks`, add the new field (alongside the existing ones):

```ts
export interface OrchestratorCallbacks {
  onMessage: (message: ChatMessage) => void;
  onStreamToken: (token: string) => void;
  onUpsertCodeBlock: (
    toolCallId: string,
    patch: { code?: string; status?: CodeBlockStatus; result?: string },
  ) => void;
  requestApproval: (code: string) => Promise<boolean>;
  /** Emitted once per runAgent call after the stream settles. */
  onTurnCost: (cost: CallCost) => void;
}
```

- [ ] **Step 8.4: Emit cost after the stream loop**

Inside `runAgent`, locate the block that ends the try/catch around `for await (const chunk of result.fullStream)` (around `orchestrator.ts:215`):

```ts
    if (capturedStreamError) throw capturedStreamError;
  } catch (err) {
    const provider = settings.providers.find(p => p.id === settings.selectedProviderId)?.name;
    const formatted = formatError(capturedStreamError ?? err, {
      phase: 'stream',
      provider,
      model: settings.selectedModel,
    });
    callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
    return messages;
  }

  const response = await result.response;
  return [...messages, ...response.messages];
}
```

Replace the lines from `if (capturedStreamError) throw capturedStreamError;` down through the function's closing `}` with:

```ts
    if (capturedStreamError) throw capturedStreamError;
  } catch (err) {
    const provider = settings.providers.find(p => p.id === settings.selectedProviderId)?.name;
    const formatted = formatError(capturedStreamError ?? err, {
      phase: 'stream',
      provider,
      model: settings.selectedModel,
    });
    callbacks.onMessage({ role: 'assistant', content: '', error: formatted });
    return messages;
  }

  // Compute the per-turn cost from per-step usage and metadata, then emit.
  // We sum per-step (rather than reading result.totalUsage + providerMetadata)
  // because result.providerMetadata only exposes the LAST step's metadata,
  // which would silently drop gateway/openrouter exact cost from earlier
  // steps in a multi-step agent loop.
  try {
    const steps = await result.steps;
    const stepCosts = steps.map(step => computeCallCost({
      providerId: settings.selectedProviderId,
      modelId: settings.selectedModel,
      usage: step.usage,
      providerMetadata: step.providerMetadata,
    }));
    callbacks.onTurnCost(stepCosts.length > 0 ? sumCallCosts(stepCosts) : emptyCallCost('estimated'));
  } catch {
    // steps rejected — skip the cost emit so the UI keeps the last known total.
  }

  const response = await result.response;
  return [...messages, ...response.messages];
}
```

- [ ] **Step 8.5: Run cost tests, verify they pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/agent/orchestrator-cost.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 8.6: Run the full test suite**

```bash
cd /root/autoOffice && npm test
```

Expected: PASS — including any pre-existing orchestrator tests (which will now also need to provide `onTurnCost`; if any of them fail, that's the next step).

- [ ] **Step 8.7: Fix any pre-existing tests broken by the new required callback**

If `npm test` reports failures in other tests passing `OrchestratorCallbacks` without `onTurnCost`, add `onTurnCost: () => {}` to each. Search-and-fix:

```bash
cd /root/autoOffice && grep -rn "OrchestratorCallbacks\|requestApproval:" src/taskpane --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v orchestrator.ts | head
```

For any test fixture that defines a callbacks object literal, add `onTurnCost: () => {}` next to `requestApproval`. Re-run `npm test` until green.

- [ ] **Step 8.8: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/agent/orchestrator.ts src/taskpane/agent/orchestrator-cost.test.ts
# Plus any fixed test files from 8.7:
# git add <those files>
git commit -m "$(cat <<'EOF'
cost: emit per-turn CallCost from runAgent

After the stream settles, walk result.steps and compute a CallCost for
each step, then sum. Per-step (not totalUsage+providerMetadata) is
required because result.providerMetadata only exposes the LAST step's
metadata — using it would drop gateway/openrouter exact cost from
earlier steps in a multi-step agent loop.
EOF
)"
```

---

## Task 9: Persist `cost` on `Conversation` and `ConversationSummary`

Optional fields, no version bump (the existing version-refusal check only triggers when on-disk `v` is GREATER than `CURRENT_VERSION`).

**Files:**
- Modify: `src/taskpane/store/history.ts`
- Modify: `src/taskpane/store/history.test.ts`

- [ ] **Step 9.1: Read the current history test layout**

```bash
cd /root/autoOffice && head -30 src/taskpane/store/history.test.ts
```

This shows the helper patterns the tests use. You'll add new tests in the same style.

- [ ] **Step 9.2: Add failing tests**

Append to `src/taskpane/store/history.test.ts`:

```ts
import { emptyCallCost } from '../agent/pricing.ts';

describe('history — cost persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips cost on a conversation', () => {
    const conv: Conversation = {
      id: 'c1', v: CURRENT_VERSION, title: 't', host: 'word',
      createdAt: 1, updatedAt: 1, messageCount: 0,
      uiMessages: [], modelMessages: [],
      cost: { ...emptyCallCost('estimated'), totalUsd: 0.42, source: 'estimated' },
      totalUsd: 0.42, costSource: 'estimated',
    };
    saveConversation(conv);
    expect(getConversation('c1')?.cost?.totalUsd).toBe(0.42);
    expect(getConversation('c1')?.cost?.source).toBe('estimated');
  });

  it('writes totalUsd and costSource to ConversationSummary index', () => {
    const conv: Conversation = {
      id: 'c2', v: CURRENT_VERSION, title: 't', host: 'word',
      createdAt: 1, updatedAt: 1, messageCount: 0,
      uiMessages: [], modelMessages: [],
      cost: { ...emptyCallCost('gateway-exact'), totalUsd: 1.23, source: 'gateway-exact' },
      totalUsd: 1.23, costSource: 'gateway-exact',
    };
    saveConversation(conv);
    const summary = listConversations().find(s => s.id === 'c2');
    expect(summary?.totalUsd).toBe(1.23);
    expect(summary?.costSource).toBe('gateway-exact');
  });

  it('loads a legacy v1 blob without cost fields', () => {
    // Hand-write a legacy blob (no cost / totalUsd / costSource).
    const legacy = {
      id: 'legacy', v: 1, title: 't', host: 'word',
      createdAt: 1, updatedAt: 1, messageCount: 0,
      uiMessages: [], modelMessages: [],
    };
    localStorage.setItem(blobKeyFor('legacy'), JSON.stringify(legacy));
    const loaded = getConversation('legacy');
    expect(loaded).not.toBeNull();
    expect(loaded?.cost).toBeUndefined();
    expect(loaded?.totalUsd).toBeUndefined();
    expect(loaded?.costSource).toBeUndefined();
  });
});
```

> Make sure `Conversation`, `CURRENT_VERSION`, `getConversation`, `saveConversation`, `listConversations`, `blobKeyFor` are all already imported at the top of the test file (the existing tests use them, so they should be).

- [ ] **Step 9.3: Run tests, verify failure**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/store/history.test.ts
```

Expected: FAIL — TypeScript errors on `cost`, `totalUsd`, `costSource` (not on the type yet) and missing `cost` on the loaded value.

- [ ] **Step 9.4: Add the optional fields**

Edit `src/taskpane/store/history.ts`. At the top, add the import:

```ts
import type { CallCost, CostSource } from '../agent/pricing.ts';
```

Then change `ConversationSummary` and `Conversation`:

```ts
export interface ConversationSummary {
  id: string;
  title: string;
  host: HostKind;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /** Running total in USD. Undefined for pre-cost-tracking conversations. */
  totalUsd?: number;
  /** Source of `totalUsd`. Used by HistoryPanel to suppress $ when tokens-only. */
  costSource?: CostSource;
}

export interface Conversation extends ConversationSummary {
  v: ConversationVersion;
  uiMessages: ChatMessage[];
  modelMessages: ModelMessage[];
  /** Aggregated per-call cost across every turn. Undefined for pre-cost-tracking conversations. */
  cost?: CallCost;
}
```

Then update `summarize` to carry the new fields:

```ts
function summarize(c: Conversation): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    host: c.host,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount,
    totalUsd: c.totalUsd,
    costSource: c.costSource,
  };
}
```

- [ ] **Step 9.5: Run tests, verify they pass**

```bash
cd /root/autoOffice && npx vitest run src/taskpane/store/history.test.ts
```

Expected: PASS — all history tests including the 3 new ones.

- [ ] **Step 9.6: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/store/history.ts src/taskpane/store/history.test.ts
git commit -m "$(cat <<'EOF'
cost: persist conversation cost in history blobs

Adds optional cost: CallCost on Conversation and totalUsd / costSource
on ConversationSummary so the HistoryPanel can show a $ per row
without loading the full blob. No version bump — fields are optional
and old conversations load with cost: undefined.
EOF
)"
```

---

## Task 10: `App.tsx` accumulates per-turn cost into the conversation

`handleSend` already builds a `Conversation` object inside the trailing `setMessages` callback. Stash the latest turn's cost in a closure variable, sum it with whatever was already on disk, and assign the result to the conversation before persisting.

**Files:**
- Modify: `src/taskpane/App.tsx`

- [ ] **Step 10.1: Add the imports App needs**

At the top of `src/taskpane/App.tsx`, alongside existing imports, add:

```ts
import { sumCallCosts, emptyCallCost, type CallCost } from './agent/pricing.ts';
```

- [ ] **Step 10.2: Capture turn cost via the new callback**

Inside `handleSend`, locate the `callbacks` object literal (around `App.tsx:187`). Just before it, declare:

```ts
    let turnCost: CallCost | null = null;
```

Then in the callbacks object, add `onTurnCost`:

```ts
    const callbacks: OrchestratorCallbacks = {
      onMessage: (msg) => setMessages(prev => [...prev, msg]),
      onStreamToken: (token) => { /* ...existing... */ },
      onUpsertCodeBlock: (toolCallId, patch) => { /* ...existing... */ },
      requestApproval: (code) => { /* ...existing... */ },
      onTurnCost: (cost) => { turnCost = cost; },
    };
```

- [ ] **Step 10.3: Merge the turn cost into the persisted Conversation**

Find the `setMessages(currentMessages => { ... })` block (around `App.tsx:256`). Inside it, after the line that reads `existing = isFirstTurn ? null : getConversation(convId!);` and before the `Conversation` object literal is built, accumulate the cost:

Replace:

```ts
    setMessages(currentMessages => {
      const now = Date.now();
      const existing = isFirstTurn ? null : getConversation(convId!);
      const conv: Conversation = {
        id: convId!,
        v: CURRENT_VERSION,
        title: isFirstTurn ? placeholder : (existing?.title ?? translationService.t('history.newChatPlaceholder')),
        host: convHost,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messageCount: currentMessages.length,
        uiMessages: currentMessages,
        modelMessages: conversationHistory.current,
      };
      if (isFirstTurn) persistImmediate(conv);
      else persistDebounced(conv);
      return currentMessages;
    });
```

with:

```ts
    setMessages(currentMessages => {
      const now = Date.now();
      const existing = isFirstTurn ? null : getConversation(convId!);
      const accumulatedCost = turnCost
        ? sumCallCosts([existing?.cost ?? emptyCallCost('estimated'), turnCost])
        : existing?.cost;
      const conv: Conversation = {
        id: convId!,
        v: CURRENT_VERSION,
        title: isFirstTurn ? placeholder : (existing?.title ?? translationService.t('history.newChatPlaceholder')),
        host: convHost,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messageCount: currentMessages.length,
        uiMessages: currentMessages,
        modelMessages: conversationHistory.current,
        cost: accumulatedCost,
        totalUsd: accumulatedCost?.totalUsd,
        costSource: accumulatedCost?.source,
      };
      if (isFirstTurn) persistImmediate(conv);
      else persistDebounced(conv);
      return currentMessages;
    });
```

- [ ] **Step 10.4: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 10.5: Run the full test suite**

```bash
cd /root/autoOffice && npm test
```

Expected: PASS.

- [ ] **Step 10.6: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/App.tsx
git commit -m "$(cat <<'EOF'
cost: accumulate per-turn cost into the persisted conversation

handleSend now stashes the turn cost emitted by the orchestrator and
merges it with the conversation's running total before persisting.
The summary fields (totalUsd, costSource) duplicate from cost so the
HistoryPanel can render without loading each blob.
EOF
)"
```

---

## Task 11: i18n strings for the cost UI

Add a `cost` namespace to both locales, then regenerate the typed keys file.

**Files:**
- Modify: `src/taskpane/i18n/locales/en.json`
- Modify: `src/taskpane/i18n/locales/he.json`
- Modify: `src/taskpane/i18n/keys.generated.ts` (auto-regenerated)

- [ ] **Step 11.1: Add the English block**

Edit `src/taskpane/i18n/locales/en.json`. Insert this block at the top level (e.g. between the `chat` and `settings` blocks — the existing file has alphabetical-ish layout):

```json
  "cost": {
    "title": "Run cost",
    "input": "Input",
    "cachedRead": "Cached read",
    "cacheWrite": "Cache write",
    "output": "Output",
    "total": "Total",
    "sourceGatewayExact": "Exact via Vercel AI Gateway",
    "sourceOpenRouterExact": "Exact via OpenRouter",
    "sourceEstimated": "Estimated · pricing v{{version}}",
    "sourceTokensOnly": "Pricing not available for this model",
    "unknown": "—"
  },
```

> The `{{version}}` interpolation matches the handlebars-style placeholders already used elsewhere (see `chat.welcomeMessage`).

- [ ] **Step 11.2: Add the Hebrew block**

Edit `src/taskpane/i18n/locales/he.json`. Insert the parallel block (natural Hebrew, no-vowels, RTL-friendly):

```json
  "cost": {
    "title": "עלות הריצה",
    "input": "קלט",
    "cachedRead": "קריאה מ-cache",
    "cacheWrite": "כתיבה ל-cache",
    "output": "פלט",
    "total": "סה\"כ",
    "sourceGatewayExact": "סכום מדויק דרך Vercel AI Gateway",
    "sourceOpenRouterExact": "סכום מדויק דרך OpenRouter",
    "sourceEstimated": "הערכה · מחירון v{{version}}",
    "sourceTokensOnly": "אין מחירון זמין לדגם זה",
    "unknown": "—"
  },
```

- [ ] **Step 11.3: Regenerate typed keys**

```bash
cd /root/autoOffice && npm run gen:i18n
```

Expected: `src/taskpane/i18n/keys.generated.ts` updates with `cost.*` keys appended in alphabetical order.

- [ ] **Step 11.4: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 11.5: Run the full test suite**

```bash
cd /root/autoOffice && npm test
```

Expected: PASS — the `tools/check-translations.test.ts` script verifies parity between locales; the new keys exist in both.

- [ ] **Step 11.6: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/i18n/locales/en.json src/taskpane/i18n/locales/he.json src/taskpane/i18n/keys.generated.ts
git commit -m "$(cat <<'EOF'
cost: add cost.* i18n keys (en, he)

Strings for the cost badge popover (per-class labels) and the source
footer (gateway-exact, openrouter-exact, estimated, tokens-only).
EOF
)"
```

---

## Task 12: `<CostBadge>` component (badge + popover)

A small Fluent UI component used in the chat header. Pure props in, JSX out.

**Files:**
- Create: `src/taskpane/components/CostBadge.tsx`

- [ ] **Step 12.1: Create the component**

Create `src/taskpane/components/CostBadge.tsx`:

```tsx
import React from 'react';
import {
  makeStyles,
  tokens,
  Badge,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Text,
} from '@fluentui/react-components';
import { type CallCost, PRICING_VERSION } from '../agent/pricing.ts';
import { formatTokens, formatUsd } from '../lib/cost.ts';
import { useTranslation } from '../i18n/index.ts';

const useStyles = makeStyles({
  badge: { cursor: 'pointer' },
  surface: { padding: '12px 14px', minWidth: '220px' },
  table: { width: '100%', fontSize: '12px', borderCollapse: 'collapse' },
  label: { color: tokens.colorNeutralForeground3, paddingRight: '12px' },
  num: { textAlign: 'end', fontFamily: tokens.fontFamilyMonospace, whiteSpace: 'nowrap' },
  total: { fontWeight: 600, paddingTop: '4px', borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  footer: { marginTop: '8px', fontSize: '11px', color: tokens.colorNeutralForeground3 },
});

interface Row { labelKey: 'cost.input' | 'cost.cachedRead' | 'cost.cacheWrite' | 'cost.output';
                tokens: number; usd: number }

export function CostBadge({ cost }: { cost: CallCost | undefined }) {
  const styles = useStyles();
  const { t } = useTranslation();
  if (!cost || (cost.totalUsd === 0 && cost.tokens.input === 0 && cost.tokens.output === 0
                                     && cost.tokens.cachedRead === 0 && cost.tokens.cacheWrite === 0)) {
    return null;
  }

  const compact = cost.source === 'tokens-only'
    ? `${formatTokens(cost.tokens.input + cost.tokens.cachedRead + cost.tokens.cacheWrite + cost.tokens.output)} tok`
    : formatUsd(cost.totalUsd);

  const rows: Row[] = [
    { labelKey: 'cost.input',       tokens: cost.tokens.input,       usd: cost.inputUsd },
    { labelKey: 'cost.cachedRead',  tokens: cost.tokens.cachedRead,  usd: cost.cachedReadUsd },
    { labelKey: 'cost.cacheWrite',  tokens: cost.tokens.cacheWrite,  usd: cost.cacheWriteUsd },
    { labelKey: 'cost.output',      tokens: cost.tokens.output,      usd: cost.outputUsd },
  ].filter(r => r.tokens > 0 || r.usd > 0);

  const sourceLabel =
    cost.source === 'gateway-exact'    ? t('cost.sourceGatewayExact') :
    cost.source === 'openrouter-exact' ? t('cost.sourceOpenRouterExact') :
    cost.source === 'tokens-only'      ? t('cost.sourceTokensOnly') :
                                         t('cost.sourceEstimated', { version: PRICING_VERSION });

  return (
    <Popover withArrow positioning="below-end">
      <PopoverTrigger disableButtonEnhancement>
        <Badge appearance="outline" size="small" color="informative" className={styles.badge}>
          {compact}
        </Badge>
      </PopoverTrigger>
      <PopoverSurface className={styles.surface}>
        <Text weight="semibold" size={200}>{t('cost.title')}</Text>
        <table className={styles.table} style={{ marginTop: '6px' }}>
          <tbody>
            {rows.map(r => (
              <tr key={r.labelKey}>
                <td className={styles.label}>{t(r.labelKey)}</td>
                <td className={styles.num}>{r.tokens > 0 ? `${formatTokens(r.tokens)} tok` : ''}</td>
                <td className={styles.num} style={{ paddingLeft: '12px' }}>
                  {cost.source === 'tokens-only' ? '' : formatUsd(r.usd)}
                </td>
              </tr>
            ))}
            {cost.source !== 'tokens-only' && (
              <tr>
                <td className={`${styles.label} ${styles.total}`}>{t('cost.total')}</td>
                <td className={`${styles.num} ${styles.total}`} />
                <td className={`${styles.num} ${styles.total}`} style={{ paddingLeft: '12px' }}>
                  {formatUsd(cost.totalUsd)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={styles.footer}>{sourceLabel}</div>
      </PopoverSurface>
    </Popover>
  );
}
```

- [ ] **Step 12.2: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS. (No tests yet — render-only; behaviour is asserted by visual inspection in Task 14 and through the existing test suite.)

- [ ] **Step 12.3: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/components/CostBadge.tsx
git commit -m "$(cat <<'EOF'
cost: add CostBadge component

Compact USD or tokens-only badge that opens a popover with a per-class
breakdown and a source footer. Hidden when there's no usable data.
EOF
)"
```

---

## Task 13: Wire `<CostBadge>` into `ChatPanel` and `App.tsx`

The badge needs the running-total cost. App passes it as a prop.

**Files:**
- Modify: `src/taskpane/components/ChatPanel.tsx`
- Modify: `src/taskpane/App.tsx`

- [ ] **Step 13.1: Add `cost` to `ChatPanelProps`**

Edit `src/taskpane/components/ChatPanel.tsx`. Add the import:

```tsx
import { CostBadge } from './CostBadge.tsx';
import type { CallCost } from '../agent/pricing.ts';
```

Then extend `ChatPanelProps` (after `activeChatHost`):

```tsx
  /** Running total cost for the active conversation. */
  cost: CallCost | undefined;
```

Destructure it in the component:

```tsx
export function ChatPanel({
  host, messages, isLoading, pendingApproval, activeChatHost, cost,
  onSend, onApprove, onOpenSettings, onOpenHistory, onNewChat,
}: ChatPanelProps) {
```

Then render `<CostBadge cost={cost} />` next to the host badge in the header. Find the existing `<Badge>` block (around line 166) and add the cost badge immediately after it:

```tsx
          <Badge
            appearance="outline"
            size="small"
            color={host.kind === 'excel' ? 'success' : host.kind === 'powerpoint' ? 'danger' : 'brand'}
          >
            {host.displayName}
          </Badge>
          <CostBadge cost={cost} />
```

- [ ] **Step 13.2: Track active conversation cost in App state**

Edit `src/taskpane/App.tsx`. After the `activeChatHost` state declaration (around `App.tsx:60`), add:

```tsx
  const [activeCost, setActiveCost] = useState<CallCost | undefined>(undefined);
```

(`CallCost` was imported in Task 10.)

- [ ] **Step 13.3: Update `activeCost` whenever the active conversation changes or saves**

Three places already manipulate the active conversation; mirror them for cost:

1. In `handleNewChat`, after `setActiveChatHost(null);`:

```tsx
    setActiveCost(undefined);
```

2. In `handleLoadConversation`, after `setActiveChatHost(conv.host);`:

```tsx
    setActiveCost(conv.cost);
```

3. In `handleDelete`, inside the `if (id === activeConversationId) {` block, after `setActiveChatHost(null);`:

```tsx
      setActiveCost(undefined);
```

4. In `handleSend`'s trailing `setMessages(currentMessages => { ... })` block, just before `if (isFirstTurn) persistImmediate(conv); else persistDebounced(conv);`, add:

```tsx
      setActiveCost(accumulatedCost);
```

- [ ] **Step 13.4: Pass `cost` into `<ChatPanel>`**

In the JSX at the bottom of `App.tsx`:

```tsx
      <ChatPanel
        host={host}
        messages={messages}
        isLoading={isLoading}
        pendingApproval={pendingApproval}
        activeChatHost={activeChatHost}
        cost={activeCost}
        onSend={handleSend}
        onApprove={handleApprove}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
        onNewChat={handleNewChat}
      />
```

- [ ] **Step 13.5: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 13.6: Run the full test suite**

```bash
cd /root/autoOffice && npm test
```

Expected: PASS. If the existing `ChatPanel` test renders without `cost`, fix it by passing `cost={undefined}`.

- [ ] **Step 13.7: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/components/ChatPanel.tsx src/taskpane/App.tsx
git commit -m "$(cat <<'EOF'
cost: wire CostBadge into ChatPanel header

App tracks the active conversation's running cost in state, kept in
sync with new chat / load / delete / save flows, and passes it into
ChatPanel. ChatPanel renders the badge next to the host badge.
EOF
)"
```

---

## Task 14: Show cost in `HistoryPanel` rows

Append `· $X.XX` to the row meta line. Hidden when undefined/zero or tokens-only.

**Files:**
- Modify: `src/taskpane/components/HistoryPanel.tsx`

- [ ] **Step 14.1: Add the import**

Edit `src/taskpane/components/HistoryPanel.tsx`. Near the existing imports add:

```tsx
import { formatUsd } from '../lib/cost.ts';
```

- [ ] **Step 14.2: Append cost to the row meta line**

Find the row meta block (around `HistoryPanel.tsx:222`):

```tsx
                <div className={styles.rowMeta}>
                  <Badge ... />
                  <span>{formatRelativeAgo(c.updatedAt, formatRelativeTime)}</span>
                  <span>·</span>
                  <span>{formatPlural(c.messageCount, {
                    one: t('history.messageCount_one'),
                    other: t('history.messageCount_other'),
                  })}</span>
                </div>
```

Add the cost cell after the message count `<span>`:

```tsx
                  {c.totalUsd != null && c.totalUsd > 0 && c.costSource !== 'tokens-only' && (
                    <>
                      <span>·</span>
                      <span>{formatUsd(c.totalUsd)}</span>
                    </>
                  )}
```

- [ ] **Step 14.3: Verify TypeScript compiles**

```bash
cd /root/autoOffice && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 14.4: Run the full test suite**

```bash
cd /root/autoOffice && npm test
```

Expected: PASS — including `HistoryPanel.test.tsx`.

- [ ] **Step 14.5: Commit**

```bash
cd /root/autoOffice
git add src/taskpane/components/HistoryPanel.tsx
git commit -m "$(cat <<'EOF'
cost: show $ per row in HistoryPanel

Suppressed when totalUsd is undefined or 0, and when costSource is
tokens-only (showing $0.00 there would be misleading).
EOF
)"
```

---

## Task 15: Manual smoke test in the browser

Type-checked code and unit tests don't prove the badge renders, the popover opens, or that real provider responses produce non-zero costs. Run the dev server.

- [ ] **Step 15.1: Start the dev server**

```bash
cd /root/autoOffice && npm run dev
```

Note the URL it prints (typically `https://localhost:3000/taskpane.html`).

- [ ] **Step 15.2: Configure a provider you can hit**

Open the taskpane in the browser. In Settings, configure whichever provider you have an API key for. If you have the **Vercel AI Gateway** key configured, prefer that — it's the easiest way to verify the gateway-exact path.

- [ ] **Step 15.3: Send a one-line message**

Send something like: `Just say "hi" back, don't write any code`.

After the assistant replies, verify:
1. **A USD badge appears** next to the host badge in the header (e.g. `$0.0042`).
2. **Clicking the badge opens a popover** showing input/output rows with token counts and per-class USD, plus a **Total** row, and a **footer** identifying source.
3. The footer reads `Estimated · pricing v2026-05` for direct providers, `Exact via Vercel AI Gateway` if you used the gateway, or `Exact via OpenRouter` if you used OpenRouter.

- [ ] **Step 15.4: Send a second message that triggers code execution**

Something like: `Write 1 to A1`. Approve the code (or set auto-approve).

Verify:
1. The badge total **increases** after the turn settles.
2. If using a gateway/openrouter provider, the popover footer still says "Exact" (the per-step sum logic worked across the multi-step turn).

- [ ] **Step 15.5: Open History**

Click the History button. Verify your conversation row shows `· $X.XX` after the message count. Click into the conversation — the badge in the header carries the same total.

- [ ] **Step 15.6: Test tokens-only path**

Switch the provider to **Ollama** or **OpenAI-Compatible** with a model id NOT in `PRICING` (e.g. configure Ollama with `llama3` if you have it locally; or just type a junk model name into openai-compatible to see the fallback even without making a real call — but you'll need a real call to populate tokens, so a working endpoint is required).

Send a message. Verify:
1. The badge shows `XXX tok` instead of a `$` amount.
2. The popover footer reads `Pricing not available for this model`.
3. The HistoryPanel row for that conversation does NOT show a `$` (because we suppress tokens-only there).

- [ ] **Step 15.7: Reload the page**

Verify the badge still shows the correct total after reload (persistence works).

- [ ] **Step 15.8: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

> No code changes in this task — it's a verification gate. If anything misbehaves, file the specific symptom against the relevant Task and fix.

---

## Task 16: Final verification + commit

- [ ] **Step 16.1: Full test pass**

```bash
cd /root/autoOffice && npm test
```

Expected: PASS — entire suite green.

- [ ] **Step 16.2: Production build smoke test**

```bash
cd /root/autoOffice && npm run build
```

Expected: PASS — `tsc && vite build` completes with no errors. Catches type problems that `--noEmit` checks miss when paired with the bundler.

- [ ] **Step 16.3: Git status sanity check**

```bash
cd /root/autoOffice && git status && git log --oneline -20
```

Expected: working tree clean; the cost-tracking commits in chronological order. No stray uncommitted files.

---

## Self-Review

Run this checklist before declaring complete:

**Spec coverage:**
- ✅ §"Per-provider cost source" (table) → covered by Tasks 3-7 (estimate path + 2 exact paths + tokens-only fallback + OpenRouter opt-in)
- ✅ §"OpenRouter opt-in" → Task 7
- ✅ §"Pricing module" → Tasks 2-6
- ✅ §"Orchestrator integration" (per-step sum, error path) → Task 8
- ✅ §"Persistence" → Task 9
- ✅ §"Aggregation in App.tsx" → Task 10
- ✅ §"UI / CostBadge" → Tasks 12-13
- ✅ §"UI / HistoryPanel" → Task 14
- ✅ §"i18n keys" → Task 11
- ✅ §"Helpers (lib/cost.ts)" → Task 1
- ✅ §"Testing" (pricing, cost, history, orchestrator) → Tasks 1, 3-6, 8, 9
- ✅ §"Migration" → covered by optional fields (Task 9) and no behaviour change for empty cost (Task 13)

**Placeholder scan:** searched the plan; no "TBD", "TODO" except the deliberate verification note in Task 2.1 about confirming PRICING rates.

**Type consistency:** `CallCost`, `CostSource`, `computeCallCost`, `sumCallCosts`, `emptyCallCost`, `PRICING_VERSION` referenced consistently across Tasks 2-14.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-04-cost-tracking.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
