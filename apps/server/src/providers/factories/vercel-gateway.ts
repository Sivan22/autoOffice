import { createGateway } from '@ai-sdk/gateway';
import type { LanguageModel } from 'ai';
export function makeVercelGateway(opts: { apiKey: string }): (modelId: string) => LanguageModel {
  const p = createGateway({ apiKey: opts.apiKey });
  return (m) => p(m);
}
