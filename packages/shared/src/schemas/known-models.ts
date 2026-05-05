import type { ProviderKind } from './provider';

// Curated suggestions for providers with stable, well-known model catalogs.
// Open-ended providers (openrouter, ollama, openai-compatible, vercel-gateway)
// are intentionally empty — the user supplies the model id directly.
export const KNOWN_MODELS: Record<ProviderKind, readonly string[]> = {
  anthropic: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'o3',
    'o3-mini',
    'o1',
    'o1-mini',
  ],
  google: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ],
  xai: [
    'grok-3',
    'grok-3-mini',
    'grok-2-latest',
    'grok-2-vision-1212',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  // ai-sdk-provider-claude-code accepts aliases ('opus' / 'sonnet' / 'haiku')
  // or full identifiers — see the package README.
  'claude-code': [
    'opus',
    'sonnet',
    'haiku',
    'claude-opus-4-5',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
  ],
  'gemini-cli': [
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
  ],
  // OpenCode addresses models as `<provider>/<model>` since one CLI fronts many.
  opencode: [
    'anthropic/claude-sonnet-4-5-20250929',
    'anthropic/claude-haiku-4-5-20251001',
    'anthropic/claude-opus-4-5-20251101',
    'openai/gpt-5.3-codex-spark',
    'openai/gpt-5.1',
    'google/gemini-3-pro-preview',
    'google/gemini-2.5-flash',
  ],
  openrouter: [],
  ollama: [],
  'openai-compatible': [],
  'vercel-gateway': [],
};

export function getKnownModels(kind: ProviderKind): readonly string[] {
  return KNOWN_MODELS[kind] ?? [];
}
