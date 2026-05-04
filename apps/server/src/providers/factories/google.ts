import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export function makeGoogle(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const provider = createGoogleGenerativeAI({ apiKey: opts.apiKey });
  return (modelId) => provider(modelId);
}
