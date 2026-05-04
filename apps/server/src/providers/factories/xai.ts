import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
export function makeXai(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createXai({ apiKey: opts.apiKey });
  return (m) => p(m);
}
