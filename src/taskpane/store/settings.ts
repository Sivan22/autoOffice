import type { Locale } from '../i18n/types';

export interface McpServerConfig {
  name: string;
  url: string;
  transport: 'streamable-http' | 'sse';
  enabled: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string; // For OpenAI-compatible local models
}

export interface AppSettings {
  selectedProviderId: string;
  selectedModel: string;
  providers: ProviderConfig[];
  autoApprove: boolean;
  mcpServers: McpServerConfig[];
  maxRetries: number;
  executionTimeout: number;
  language: Locale;
}

const DEFAULT_SETTINGS: AppSettings = {
  selectedProviderId: '',
  selectedModel: '',
  providers: [
    { id: 'anthropic', name: 'Anthropic', apiKey: '' },
    { id: 'openai', name: 'OpenAI', apiKey: '' },
    { id: 'google', name: 'Google', apiKey: '' },
    { id: 'groq', name: 'Groq', apiKey: '' },
    { id: 'xai', name: 'xAI', apiKey: '' },
    { id: 'deepseek', name: 'DeepSeek', apiKey: '' },
    { id: 'gateway', name: 'Vercel AI Gateway', apiKey: '' },
    { id: 'openai-compatible', name: 'OpenAI-Compatible', apiKey: '', baseUrl: '' },
  ],
  autoApprove: false,
  mcpServers: [],
  maxRetries: 3,
  executionTimeout: 30000,
  language: 'en',
};

const STORAGE_KEY = 'autooffice_settings';

function isOfficeEnvironment(): boolean {
  return typeof Office !== 'undefined' && !!Office.context?.roamingSettings;
}

function mergeSettings(saved: Partial<AppSettings>): AppSettings {
  const merged: AppSettings = { ...DEFAULT_SETTINGS, ...saved };
  const savedProviders = saved.providers ?? [];
  merged.providers = DEFAULT_SETTINGS.providers.map(def => {
    const existing = savedProviders.find(p => p.id === def.id);
    return existing ? { ...def, ...existing } : def;
  });
  return merged;
}

export function loadSettings(): AppSettings {
  try {
    if (isOfficeEnvironment()) {
      const raw = Office.context.roamingSettings.get(STORAGE_KEY);
      if (raw) return mergeSettings(JSON.parse(raw));
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeSettings(JSON.parse(raw));
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  const json = JSON.stringify(settings);
  try {
    if (isOfficeEnvironment()) {
      Office.context.roamingSettings.set(STORAGE_KEY, json);
      Office.context.roamingSettings.saveAsync();
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  } catch {
    // Silent failure — settings will be lost on next load
  }
}
