import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';
import type { LanguageModel } from 'ai';

export function makeGeminiCli(opts: { authType?: 'oauth-personal' | 'gemini-api-key'; apiKey?: string }): (modelId: string) => LanguageModel {
  const authType = opts.authType ?? 'oauth-personal';
  const provider =
    authType === 'gemini-api-key'
      ? createGeminiProvider({
          authType: 'gemini-api-key',
          ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
        })
      : createGeminiProvider({ authType: 'oauth-personal' });
  return (modelId) => provider(modelId);
}
