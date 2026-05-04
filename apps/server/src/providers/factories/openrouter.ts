import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
export function makeOpenRouter(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createOpenRouter({ apiKey: opts.apiKey });
  return (m) => p(m);
}
