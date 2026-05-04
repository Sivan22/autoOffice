import { describe, expect, it } from 'vitest';
import type { LanguageModelUsage } from 'ai';
import { computeCallCost, emptyCallCost, PRICING, sumCallCosts } from './pricing.ts';

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
