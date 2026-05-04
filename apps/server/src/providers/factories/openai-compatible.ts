import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
export function makeOpenAICompatible(opts: { name: string; apiKey?: string; baseURL: string }): (modelId: string) => LanguageModel {
  const p = createOpenAICompatible({
    name: opts.name,
    baseURL: opts.baseURL,
    ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
  });
  return (m) => p(m);
}
