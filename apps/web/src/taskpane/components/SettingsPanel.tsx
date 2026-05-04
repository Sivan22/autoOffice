import React, { useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Divider,
  Field,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Add24Regular,
  Delete24Regular,
  Eye24Regular,
  EyeOff24Regular,
} from '@fluentui/react-icons';
import type { AppSettings, McpServerConfig } from '../store/settings.ts';
import { useTranslation, availableLocales, type LocaleId } from '../i18n/index.ts';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  mcpServer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '6px',
  },
  keyInput: {
    flex: 1,
  },
});

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  anthropic: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-6',
  ],
  openai: [
    'gpt-5.4',
    'gpt-5.4-pro',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    'gpt-5.3-chat-latest',
    'gpt-5.3-codex',
    'gpt-5',
    'gpt-4o',
    'gpt-4o-mini',
  ],
  google: [
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ],
  groq: [
    'moonshotai/kimi-k2-instruct-0905',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'qwen/qwen3-32b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
  ],
  xai: [
    'grok-4',
    'grok-4-fast',
    'grok-code-fast-1',
    'grok-3',
    'grok-3-mini',
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
  gateway: [],
  openrouter: [],
  ollama: [],
  'openai-compatible': [],
};

const PROVIDERS_WITH_BASE_URL = new Set(['openai-compatible', 'openrouter', 'ollama']);
const PROVIDERS_WITHOUT_API_KEY = new Set(['ollama']);

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const styles = useStyles();
  const { t, locale, setLocale } = useTranslation();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const updateProvider = (id: string, field: string, value: string) => {
    const providers = settings.providers.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    onChange({ ...settings, providers });
  };

  const addMcpServer = () => {
    const newServer: McpServerConfig = {
      name: `Server ${settings.mcpServers.length + 1}`,
      url: '',
      transport: 'streamable-http',
      enabled: true,
    };
    onChange({ ...settings, mcpServers: [...settings.mcpServers, newServer] });
  };

  const updateMcpServer = (index: number, updates: Partial<McpServerConfig>) => {
    const servers = settings.mcpServers.map((s, i) =>
      i === index ? { ...s, ...updates } : s
    );
    onChange({ ...settings, mcpServers: servers });
  };

  const removeMcpServer = (index: number) => {
    onChange({
      ...settings,
      mcpServers: settings.mcpServers.filter((_, i) => i !== index),
    });
  };

  const selectedProvider = settings.providers.find(p => p.id === settings.selectedProviderId);
  const models = PROVIDER_MODELS[settings.selectedProviderId] || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button appearance="subtle" icon={<ArrowLeft24Regular />} onClick={onClose} />
        <Text weight="semibold" size={400}>{t('settings.title')}</Text>
      </div>

      <div className={styles.content}>
        {/* AI Provider */}
        <div className={styles.section}>
          <Text weight="semibold" size={300}>{t('settings.providerSection')}</Text>

          <Field label={t('settings.providerLabel')}>
            <Select
              value={settings.selectedProviderId}
              onChange={(_, data) => onChange({ ...settings, selectedProviderId: data.value, selectedModel: '' })}
            >
              <option value="">{t('settings.providerPlaceholder')}</option>
              {settings.providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>

          {selectedProvider && (
            <>
              {!PROVIDERS_WITHOUT_API_KEY.has(selectedProvider.id) && (
                <Field label={t('settings.apiKeyLabel')}>
                  <div className={styles.row}>
                    <Input
                      className={styles.keyInput}
                      type={showKeys[selectedProvider.id] ? 'text' : 'password'}
                      value={selectedProvider.apiKey}
                      onChange={(_, data) => updateProvider(selectedProvider.id, 'apiKey', data.value)}
                      placeholder={t('settings.apiKeyPlaceholder')}
                    />
                    <Button
                      appearance="subtle"
                      icon={showKeys[selectedProvider.id] ? <EyeOff24Regular /> : <Eye24Regular />}
                      onClick={() => setShowKeys(prev => ({ ...prev, [selectedProvider.id]: !prev[selectedProvider.id] }))}
                    />
                  </div>
                </Field>
              )}

              {PROVIDERS_WITH_BASE_URL.has(selectedProvider.id) && (
                <Field label={t('settings.baseUrlLabel')}>
                  <Input
                    value={selectedProvider.baseUrl || ''}
                    onChange={(_, data) => updateProvider(selectedProvider.id, 'baseUrl', data.value)}
                    placeholder={t('settings.baseUrlPlaceholder')}
                  />
                </Field>
              )}

              <Field label={t('settings.modelLabel')}>
                {models.length > 0 ? (
                  <Select
                    value={settings.selectedModel}
                    onChange={(_, data) => onChange({ ...settings, selectedModel: data.value })}
                  >
                    <option value="">{t('settings.modelSelectPlaceholder')}</option>
                    {models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={settings.selectedModel}
                    onChange={(_, data) => onChange({ ...settings, selectedModel: data.value })}
                    placeholder={t('settings.modelPlaceholder')}
                  />
                )}
              </Field>
            </>
          )}
        </div>

        <Divider />

        {/* Execution */}
        <div className={styles.section}>
          <Text weight="semibold" size={300}>{t('settings.executionSection')}</Text>

          <Field label={t('settings.autoApproveLabel')}>
            <Switch
              checked={settings.autoApprove}
              onChange={(_, data) => onChange({ ...settings, autoApprove: data.checked })}
            />
          </Field>

          <Field label={t('settings.maxRetriesLabel')}>
            <Input
              type="number"
              value={String(settings.maxRetries)}
              onChange={(_, data) => onChange({ ...settings, maxRetries: parseInt(data.value) || 3 })}
              min="1"
              max="10"
            />
          </Field>

          <Field label={t('settings.timeoutLabel')}>
            <Input
              type="number"
              value={String(settings.executionTimeout / 1000)}
              onChange={(_, data) => onChange({ ...settings, executionTimeout: (parseInt(data.value) || 30) * 1000 })}
              min="5"
              max="120"
            />
          </Field>
        </div>

        <Divider />

        {/* MCP Servers */}
        <div className={styles.section}>
          <div className={styles.row}>
            <Text weight="semibold" size={300}>{t('settings.mcpSection')}</Text>
            <Button appearance="subtle" icon={<Add24Regular />} size="small" onClick={addMcpServer}>
              {t('settings.mcpAddButton')}
            </Button>
          </div>

          {settings.mcpServers.length === 0 && (
            <Text size={200} italic>{t('settings.mcpNoServers')}</Text>
          )}

          {settings.mcpServers.map((server, i) => (
            <div key={i} className={styles.mcpServer}>
              <div className={styles.row}>
                <Input
                  value={server.name}
                  onChange={(_, data) => updateMcpServer(i, { name: data.value })}
                  placeholder={t('settings.mcpNamePlaceholder')}
                  size="small"
                  style={{ flex: 1 }}
                />
                <Switch
                  checked={server.enabled}
                  onChange={(_, data) => updateMcpServer(i, { enabled: data.checked })}
                />
                <Button
                  appearance="subtle"
                  icon={<Delete24Regular />}
                  size="small"
                  onClick={() => removeMcpServer(i)}
                />
              </div>
              <Input
                value={server.url}
                onChange={(_, data) => updateMcpServer(i, { url: data.value })}
                placeholder={t('settings.mcpUrlPlaceholder')}
                size="small"
              />
              <Select
                value={server.transport}
                onChange={(_, data) => updateMcpServer(i, { transport: data.value as McpServerConfig['transport'] })}
                size="small"
              >
                <option value="streamable-http">Streamable HTTP</option>
                <option value="sse">SSE</option>
              </Select>
            </div>
          ))}
        </div>

        <Divider />

        {/* Language */}
        <div className={styles.section}>
          <Text weight="semibold" size={300}>{t('settings.languageSection')}</Text>
          <Select
            value={locale}
            aria-label={t('settings.languageSection')}
            onChange={(_, data) => { void setLocale(data.value as LocaleId); }}
          >
            {availableLocales().map(l => (
              <option key={l.id} value={l.id}>{l.nativeName}</option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
