import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
export function makeOllama(opts: { baseURL?: string }): (modelId: string) => LanguageModel {
  const p = createOllama({ baseURL: opts.baseURL ?? 'http://localhost:11434/api' });
  return (m) => p(m);
}
