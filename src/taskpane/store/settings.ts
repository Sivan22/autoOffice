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
}

const DEFAULT_SETTINGS: AppSettings = {
  selectedProviderId: '',
  selectedModel: '',
  providers: [
    { id: 'anthropic', name: 'Anthropic', apiKey: '' },
    { id: 'openai', name: 'OpenAI', apiKey: '' },
    { id: 'openai-compatible', name: 'OpenAI-Compatible', apiKey: '', baseUrl: '' },
  ],
  autoApprove: false,
  mcpServers: [],
  maxRetries: 3,
  executionTimeout: 30000,
};

const STORAGE_KEY = 'autooffice_settings';

function isOfficeEnvironment(): boolean {
  return typeof Office !== 'undefined' && !!Office.context?.roamingSettings;
}

export function loadSettings(): AppSettings {
  try {
    if (isOfficeEnvironment()) {
      const raw = Office.context.roamingSettings.get(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
