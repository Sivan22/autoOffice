import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
export function makeGroq(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createGroq({ apiKey: opts.apiKey });
  return (m) => p(m);
}
