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
