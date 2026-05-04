import { createOpencode } from 'ai-sdk-provider-opencode-sdk';
import type { LanguageModel } from 'ai';

export function makeOpencode(opts: Record<string, unknown> = {}): (modelId: string) => LanguageModel {
  const provider = createOpencode({ ...opts });
  return (modelId) => provider(modelId);
}
