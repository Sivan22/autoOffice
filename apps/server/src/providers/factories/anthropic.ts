import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';

export function makeAnthropic(opts: { apiKey: string; baseURL?: string }): (modelId: string) => LanguageModel {
  const provider = createAnthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  return (modelId) => provider(modelId);
}
