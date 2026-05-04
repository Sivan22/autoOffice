import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModel } from 'ai';
export function makeDeepSeek(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createDeepSeek({ apiKey: opts.apiKey });
  return (m) => p(m);
}
