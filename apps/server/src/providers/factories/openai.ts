import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export function makeOpenAI(opts: { apiKey: string; baseURL?: string; organization?: string }): (modelId: string) => LanguageModel {
  const provider = createOpenAI({
    apiKey: opts.apiKey,
    ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
    ...(opts.organization ? { organization: opts.organization } : {}),
  });
  return (modelId) => provider(modelId);
}
