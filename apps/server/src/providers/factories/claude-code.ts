import { createClaudeCode } from 'ai-sdk-provider-claude-code';
import type { LanguageModel } from 'ai';

export function makeClaudeCode(opts: { binaryPath?: string }): (modelId: string) => LanguageModel {
  const provider = createClaudeCode(
    opts.binaryPath
      ? { defaultSettings: { pathToClaudeCodeExecutable: opts.binaryPath } }
      : {},
  );
  return (modelId) => provider(modelId);
}
