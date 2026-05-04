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
