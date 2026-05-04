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

export function sumCallCosts(_costs: CallCost[]): CallCost {
  throw new Error('not yet implemented');
}
