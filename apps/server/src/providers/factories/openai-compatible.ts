import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
export function makeOpenAICompatible(opts: { name: string; apiKey?: string; baseURL: string }): (modelId: string) => LanguageModel {
  const p = createOpenAICompatible({ name: opts.name, apiKey: opts.apiKey, baseURL: opts.baseURL });
  return (m) => p(m);
}
