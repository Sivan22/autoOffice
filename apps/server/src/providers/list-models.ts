import { getKnownModels, isCliBridge, type ProviderKind } from '@autooffice/shared';

// Default catalog endpoints per kind. Each provider's documented "list models"
// API; OpenAI-compatible kinds all expose `/v1/models` returning {data:[{id}]}.
const DEFAULT_BASE: Partial<Record<ProviderKind, string>> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  'vercel-gateway': 'https://ai-gateway.vercel.sh/v1',
};

function readString(config: Record<string, unknown>, key: string): string | undefined {
  const v = config[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

async function fetchOpenAIStyle(baseURL: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  return (json.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string')
    .sort();
}

async function fetchAnthropic(baseURL: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseURL.replace(/\/+$/, '')}/v1/models`, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  return (json.data ?? [])
    .map((m) => m.id)
    .filter((id): id is string => typeof id === 'string')
    .sort();
}

async function fetchGoogle(apiKey: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  return (json.models ?? [])
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((id) => id.length > 0)
    .sort();
}

async function fetchOllama(baseURL: string): Promise<string[]> {
  // Ollama factory defaults to `http://localhost:11434/api`; tag endpoint lives at /api/tags
  // off the host root, so strip a trailing /api if present.
  const root = baseURL.replace(/\/+$/, '').replace(/\/api$/, '');
  const res = await fetch(`${root}/api/tags`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as { models?: Array<{ name?: string }> };
  return (json.models ?? [])
    .map((m) => m.name)
    .filter((n): n is string => typeof n === 'string')
    .sort();
}

export type ListModelsResult = {
  models: string[];
  source: 'live' | 'fallback';
  message?: string;
};

export async function listModelsForProvider(
  kind: ProviderKind,
  apiKey: string | null,
  rawConfig: unknown,
): Promise<ListModelsResult> {
  const config = (rawConfig && typeof rawConfig === 'object' ? rawConfig : {}) as Record<
    string,
    unknown
  >;
  const fallback = (message?: string): ListModelsResult => ({
    models: [...getKnownModels(kind)],
    source: 'fallback',
    ...(message ? { message } : {}),
  });

  if (isCliBridge(kind)) return fallback();

  try {
    switch (kind) {
      case 'anthropic': {
        if (!apiKey) return fallback('no api key');
        const baseURL = readString(config, 'baseURL') ?? 'https://api.anthropic.com';
        return { models: await fetchAnthropic(baseURL, apiKey), source: 'live' };
      }
      case 'google': {
        if (!apiKey) return fallback('no api key');
        return { models: await fetchGoogle(apiKey), source: 'live' };
      }
      case 'ollama': {
        const baseURL = readString(config, 'baseURL') ?? 'http://localhost:11434';
        return { models: await fetchOllama(baseURL), source: 'live' };
      }
      case 'openai':
      case 'groq':
      case 'xai':
      case 'deepseek':
      case 'openrouter':
      case 'vercel-gateway':
      case 'openai-compatible': {
        if (!apiKey) return fallback('no api key');
        const baseURL = readString(config, 'baseURL') ?? DEFAULT_BASE[kind];
        if (!baseURL) return fallback('no baseURL configured');
        return { models: await fetchOpenAIStyle(baseURL, apiKey), source: 'live' };
      }
      default:
        return fallback();
    }
  } catch (err) {
    return fallback((err as Error).message);
  }
}
