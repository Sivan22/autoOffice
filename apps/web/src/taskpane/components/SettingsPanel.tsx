import React, { useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Input,
  Field,
  Switch,
  Select,
  Combobox,
  Option,
  Text,
  Divider,
  TabList,
  Tab,
  Badge,
  Spinner,
  Link,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Add24Regular,
  Delete24Regular,
  ArrowClockwise24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Checkmark24Regular,
} from '@fluentui/react-icons';
import { apiGet, apiSend, getToken } from '../api.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import type {
  Settings,
  ProviderConfig,
  ProviderKind,
  McpServerView,
  McpPolicy,
  CreateMcpServerInput,
  McpStatus,
} from '@autooffice/shared';
import { getKnownModels } from '@autooffice/shared';
import { availableLocales, useTranslation, type LocaleId } from '../i18n/index.ts';

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
  tabs: {
    flexShrink: 0,
    padding: '0 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  body: {
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
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '6px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    flex: 1,
    fontWeight: 500,
  },
  errorBanner: {
    color: tokens.colorPaletteRedForeground1,
    padding: '6px 0',
  },
  testRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0',
  },
  testResult: {
    fontStyle: 'italic',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    maxHeight: '180px',
    overflowY: 'auto',
    padding: '6px 8px',
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px',
  },
  toolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0',
  },
  toolName: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logBox: {
    fontFamily: 'monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
    background: tokens.colorNeutralBackground4,
    padding: '8px',
    borderRadius: '4px',
    maxHeight: '160px',
    overflow: 'auto',
  },
});

const PROVIDER_KINDS: { value: ProviderKind; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'groq', label: 'Groq' },
  { value: 'xai', label: 'xAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
  { value: 'vercel-gateway', label: 'Vercel AI Gateway' },
  { value: 'gemini-cli', label: 'Gemini CLI' },
  { value: 'opencode', label: 'OpenCode (CLI)' },
];

const STATUS_BADGE: Record<McpStatus, 'informative' | 'success' | 'danger' | 'warning' | 'subtle'> = {
  connecting: 'informative',
  connected: 'success',
  disconnected: 'subtle',
  error: 'danger',
  disabled: 'warning',
};

export interface SettingsPanelProps {
  onClose: () => void;
}

type TabKey = 'general' | 'mcp';

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('general');

  return (
    <div className={styles.container} role="dialog" aria-label={t('settings.title')}>
      <div className={styles.header}>
        <Button
          appearance="subtle"
          icon={<Dismiss24Regular />}
          onClick={onClose}
          aria-label={t('settings.closeAria')}
        />
        <Text weight="semibold">{t('settings.title')}</Text>
      </div>
      <div className={styles.tabs}>
        <TabList
          selectedValue={tab}
          onTabSelect={(_, d) => setTab(d.value as TabKey)}
          size="small"
        >
          <Tab value="general">{t('settings.tabGeneral')}</Tab>
          <Tab value="mcp">{t('settings.tabMcp')}</Tab>
        </TabList>
      </div>
      <div className={styles.body}>
        {tab === 'general' && <GeneralSection />}
        {tab === 'mcp' && <McpSection />}
      </div>
    </div>
  );
}

// ─────────────────────────── General ───────────────────────────

function GeneralSection() {
  const styles = useStyles();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const { t, setLocale } = useTranslation();
  const locales = availableLocales();

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [s, p] = await Promise.all([
        apiGet<Settings>('/api/settings'),
        apiGet<ProviderConfig[]>('/api/providers'),
      ]);
      setSettings(s);
      setProviders(p);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading || !settings) {
    return error ? <div className={styles.errorBanner}>{error}</div> : <Spinner size="tiny" />;
  }

  const updateSettings = async (patch: Partial<Settings>) => {
    setError(null);
    try {
      const next = await apiSend<Settings>('/api/settings', patch, 'PUT');
      setSettings(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Active provider = the selected one, or fall back to the first existing.
  // The picker still shows a kind (defaulting to anthropic) when nothing is
  // configured yet, so the user can configure by typing into the credentials.
  const active =
    providers.find((p) => p.id === settings.selectedProviderId) ?? providers[0] ?? null;
  const selectedKind: ProviderKind = active?.kind ?? 'anthropic';

  const findByKind = (kind: ProviderKind): ProviderConfig | null =>
    providers.find((p) => p.kind === kind) ?? null;

  const ensureSelected = async (
    kind: ProviderKind,
    extra?: { apiKey?: string; config?: Record<string, unknown> },
  ): Promise<string> => {
    const existing = findByKind(kind);
    if (existing) {
      if (extra && (extra.apiKey || extra.config)) {
        await apiSend(`/api/providers/${existing.id}`, extra, 'PUT');
      }
      if (settings.selectedProviderId !== existing.id) {
        const next = await apiSend<Settings>(
          '/api/settings',
          { selectedProviderId: existing.id, selectedModelId: null },
          'PUT',
        );
        setSettings(next);
      }
      return existing.id;
    }
    const r = await apiSend<{ id: string }>('/api/providers', {
      kind,
      label: labelForKind(kind),
      ...(extra?.apiKey ? { apiKey: extra.apiKey } : {}),
      ...(extra?.config ? { config: extra.config } : {}),
    });
    const next = await apiSend<Settings>(
      '/api/settings',
      { selectedProviderId: r.id, selectedModelId: null },
      'PUT',
    );
    setSettings(next);
    return r.id;
  };

  const pickKind = async (kind: ProviderKind) => {
    setError(null);
    setTestResult(null);
    try {
      await ensureSelected(kind);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveCredentials = async (extra: {
    apiKey?: string;
    config?: Record<string, unknown>;
  }) => {
    setError(null);
    try {
      await ensureSelected(selectedKind, extra);
      await reload();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };

  const saveModel = async (modelId: string) => {
    await updateSettings({ selectedModelId: modelId || null });
  };

  const test = async () => {
    if (!active) return;
    setTestResult(t('settings.testResultTesting'));
    try {
      const r = await apiSend<{ status: string; message?: string }>(
        `/api/providers/${active.id}/test`,
        {},
      );
      setTestResult(r.message ? `${r.status}: ${r.message}` : r.status);
    } catch (e) {
      setTestResult(`error: ${(e as Error).message}`);
    }
  };

  return (
    <>
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          {t('settings.providerSection')}
        </Text>
        <Field label={t('settings.providerLabel')}>
          <Select
            value={selectedKind}
            onChange={(_, d) => void pickKind(d.value as ProviderKind)}
          >
            {PROVIDER_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>

        <ProviderCredentials
          kind={selectedKind}
          provider={findByKind(selectedKind)}
          onSave={saveCredentials}
        />

        <ModelField
          providerId={active?.id ?? null}
          providerKind={selectedKind}
          value={settings.selectedModelId ?? ''}
          onChange={(v) => void saveModel(v)}
        />

        {active && active.kind === selectedKind && (
          <>
            <div className={styles.testRow}>
              <Button appearance="subtle" size="small" onClick={() => void test()}>
                {t('settings.testButton')}
              </Button>
            </div>
            {testResult && <div className={styles.testResult}>{testResult}</div>}
          </>
        )}
      </div>

      <Divider />

      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          {t('settings.executionSection')}
        </Text>
        <Field label={t('settings.autoApproveLabel')}>
          <Switch
            checked={settings.autoApprove}
            onChange={(_, d) => void updateSettings({ autoApprove: d.checked })}
          />
        </Field>
        <Field label={t('settings.maxStepsLabel')}>
          <Input
            type="number"
            value={String(settings.maxSteps)}
            onChange={(_, d) => {
              const n = parseInt(d.value, 10);
              if (!Number.isNaN(n)) void updateSettings({ maxSteps: n });
            }}
            min={1}
            max={50}
          />
        </Field>
      </div>

      <Divider />

      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          {t('settings.languageSection')}
        </Text>
        <Field label={t('settings.languageLabel')}>
          <Select
            value={settings.locale}
            onChange={(_, d) => {
              const next = d.value as LocaleId;
              void updateSettings({ locale: next });
              void setLocale(next);
            }}
          >
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nativeName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}

function ModelField({
  providerId,
  providerKind,
  value,
  onChange,
}: {
  providerId: string | null;
  providerKind: ProviderKind | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [source, setSource] = useState<'live' | 'fallback' | 'idle'>('idle');
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => setDraft(value), [value]);

  // Pull the catalog from the provider on each provider change. Server falls
  // back to KNOWN_MODELS when the live fetch fails (e.g. no key, offline).
  useEffect(() => {
    if (!providerId || !providerKind) {
      setSuggestions(providerKind ? getKnownModels(providerKind) : []);
      setSource('idle');
      setHint(null);
      return;
    }
    let cancelled = false;
    setSource('idle');
    setHint(null);
    apiGet<{ models: string[]; source: 'live' | 'fallback'; message?: string }>(
      `/api/providers/${providerId}/models`,
    )
      .then((r) => {
        if (cancelled) return;
        setSuggestions(r.models);
        setSource(r.source);
        setHint(r.source === 'fallback' ? r.message ?? t('settings.modelHintFallback') : null);
      })
      .catch((e) => {
        if (cancelled) return;
        setSuggestions(getKnownModels(providerKind));
        setSource('fallback');
        setHint((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [providerId, providerKind, t]);

  const disabled = !providerId;
  const hintText = disabled
    ? t('settings.modelHintNoProvider')
    : source === 'live'
      ? t('settings.modelHintLive', { count: suggestions.length })
      : hint ?? t('settings.modelHintDefault');

  if (suggestions.length === 0) {
    return (
      <Field label={t('settings.modelLabel')} hint={hintText}>
        <Input
          disabled={disabled}
          value={draft}
          onChange={(_, d) => setDraft(d.value)}
          onBlur={() => {
            if (draft !== value) onChange(draft);
          }}
          placeholder={t('settings.modelPlaceholder')}
        />
      </Field>
    );
  }

  return (
    <Field label={t('settings.modelLabel')} hint={hintText}>
      <Combobox
        freeform
        disabled={disabled}
        value={draft}
        selectedOptions={suggestions.includes(draft) ? [draft] : []}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onOptionSelect={(_, d) => {
          const v = d.optionValue ?? '';
          setDraft(v);
          if (v !== value) onChange(v);
        }}
        onBlur={() => {
          if (draft !== value) onChange(draft);
        }}
        placeholder={t('settings.modelPlaceholder')}
      >
        {suggestions.map((m) => (
          <Option key={m} value={m}>
            {m}
          </Option>
        ))}
      </Combobox>
    </Field>
  );
}

// ─────────────────────────── Providers ───────────────────────────

function labelForKind(kind: ProviderKind): string {
  return PROVIDER_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function ProviderCredentials({
  kind,
  provider,
  onSave,
}: {
  kind: ProviderKind;
  provider: ProviderConfig | null;
  onSave: (extra: { apiKey?: string; config?: Record<string, unknown> }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const cfg = (provider?.config ?? {}) as Record<string, unknown>;
  const [binaryPath, setBinaryPath] = useState((cfg.binaryPath as string) ?? '');
  const [geminiAuthType, setGeminiAuthType] = useState<'oauth-personal' | 'gemini-api-key'>(
    (cfg.authType as 'oauth-personal' | 'gemini-api-key') ?? 'oauth-personal',
  );
  const [opencodeHostname, setOpencodeHostname] = useState((cfg.hostname as string) ?? '');
  const [opencodePort, setOpencodePort] = useState(
    cfg.port != null ? String(cfg.port) : '',
  );

  // When the user switches kind or the underlying provider changes, reset the
  // local draft state to match the stored config.
  useEffect(() => {
    setBinaryPath((cfg.binaryPath as string) ?? '');
    setGeminiAuthType(
      (cfg.authType as 'oauth-personal' | 'gemini-api-key') ?? 'oauth-personal',
    );
    setOpencodeHostname((cfg.hostname as string) ?? '');
    setOpencodePort(cfg.port != null ? String(cfg.port) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id, kind]);

  const commitApiKey = (key: string) => onSave({ apiKey: key });

  if (kind === 'claude-code') {
    return (
      <Field label={t('settings.binaryPathLabel')} hint={t('settings.binaryPathHint')}>
        <Input
          value={binaryPath}
          onChange={(_, d) => setBinaryPath(d.value)}
          onBlur={() => {
            const v = binaryPath.trim();
            if ((cfg.binaryPath ?? '') === v) return;
            const nextCfg = { ...cfg };
            if (v) nextCfg.binaryPath = v;
            else delete nextCfg.binaryPath;
            void onSave({ config: nextCfg }).catch(() => {});
          }}
          placeholder={t('settings.binaryPathPlaceholder')}
        />
      </Field>
    );
  }

  if (kind === 'gemini-cli') {
    return (
      <>
        <Field label={t('settings.geminiAuthLabel')} hint={t('settings.geminiAuthHint')}>
          <Select
            value={geminiAuthType}
            onChange={(_, d) => {
              const next = d.value as 'oauth-personal' | 'gemini-api-key';
              setGeminiAuthType(next);
              void onSave({ config: { ...cfg, authType: next } }).catch(() => {});
            }}
          >
            <option value="oauth-personal">{t('settings.geminiAuthOAuth')}</option>
            <option value="gemini-api-key">{t('settings.geminiAuthApiKey')}</option>
          </Select>
        </Field>
        {geminiAuthType === 'gemini-api-key' && (
          <Field label={t('settings.geminiApiKeyLabel')}>
            <ApiKeyControl
              hasKey={!!provider?.hasKey}
              onCommit={commitApiKey}
              placeholder={t('settings.geminiApiKeyPlaceholder')}
            />
          </Field>
        )}
      </>
    );
  }

  if (kind === 'opencode') {
    return (
      <>
        <Field label={t('settings.opencodeHostnameLabel')} hint={t('settings.opencodeHostnameHint')}>
          <Input
            value={opencodeHostname}
            onChange={(_, d) => setOpencodeHostname(d.value)}
            onBlur={() => {
              const v = opencodeHostname.trim();
              if ((cfg.hostname ?? '') === v) return;
              const nextCfg = { ...cfg };
              if (v) nextCfg.hostname = v;
              else delete nextCfg.hostname;
              void onSave({ config: nextCfg }).catch(() => {});
            }}
            placeholder={t('settings.opencodeHostnamePlaceholder')}
          />
        </Field>
        <Field label={t('settings.opencodePortLabel')} hint={t('settings.opencodePortHint')}>
          <Input
            type="number"
            value={opencodePort}
            onChange={(_, d) => setOpencodePort(d.value)}
            onBlur={() => {
              const raw = opencodePort.trim();
              const n = raw ? parseInt(raw, 10) : NaN;
              const stored = cfg.port == null ? '' : String(cfg.port);
              if (stored === raw) return;
              const nextCfg = { ...cfg };
              if (!Number.isNaN(n)) nextCfg.port = n;
              else delete nextCfg.port;
              void onSave({ config: nextCfg }).catch(() => {});
            }}
            placeholder={t('settings.opencodePortPlaceholder')}
          />
        </Field>
      </>
    );
  }

  return (
    <Field label={t('settings.apiKeyLabel')}>
      <ApiKeyControl
        hasKey={!!provider?.hasKey}
        onCommit={commitApiKey}
        placeholder={t('settings.apiKeyPlaceholder')}
      />
    </Field>
  );
}

function ApiKeyControl({
  hasKey,
  onCommit,
  placeholder,
}: {
  hasKey: boolean;
  onCommit: (key: string) => Promise<void>;
  placeholder: string;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  // Default to editing whenever no key is stored; collapsing to "Change key"
  // only makes sense once a key actually exists.
  const [editing, setEditing] = useState(!hasKey);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);

  // Re-sync when the underlying key state flips (e.g. provider switch, save).
  useEffect(() => {
    setEditing(!hasKey);
    setValue('');
    setShow(false);
  }, [hasKey]);

  if (!editing) {
    return (
      <Link as="button" type="button" onClick={() => setEditing(true)}>
        {t('settings.changeKey')}
      </Link>
    );
  }

  const commit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      // Empty blur after a key is already stored — silently revert to the link.
      if (hasKey) setEditing(false);
      return;
    }
    try {
      await onCommit(trimmed);
      setValue('');
      // The hasKey effect above will close editing on next render once the
      // server confirms the key was stored.
    } catch {
      // keep the draft so the user can retry
    }
  };

  return (
    <div className={styles.row}>
      <Input
        style={{ flex: 1 }}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(_, d) => setValue(d.value)}
        onBlur={() => void commit()}
        placeholder={placeholder}
      />
      {/* mouseDown.preventDefault keeps focus on the input so onBlur doesn't
          fire commit() before the click handler does. */}
      <Button
        appearance="subtle"
        icon={<Checkmark24Regular />}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void commit()}
        disabled={!value.trim()}
        aria-label={t('settings.saveKeyAria')}
      />
      <Button
        appearance="subtle"
        icon={show ? <EyeOff24Regular /> : <Eye24Regular />}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('settings.hideKeyAria') : t('settings.showKeyAria')}
      />
    </div>
  );
}

// ─────────────────────────── MCP ───────────────────────────

type StatusEvent = { serverId: string; status: McpStatus; errorMessage?: string | null; toolCount?: number };

function McpSection() {
  const styles = useStyles();
  const { t } = useTranslation();
  const [servers, setServers] = useState<McpServerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteLabel =
    servers.find((s) => s.id === pendingDeleteId)?.label ?? 'this server';

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setServers(await apiGet<McpServerView[]>('/api/mcp/servers'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Subscribe to /api/mcp/events SSE for live status updates while open.
  // EventSource doesn't support Authorization headers, so use fetch + a
  // ReadableStream reader to parse SSE manually.
  useEffect(() => {
    let token: string;
    try {
      token = getToken();
    } catch {
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/mcp/events', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const block = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const ev: StatusEvent = JSON.parse(dataLine.slice(5).trim());
              setServers((prev) =>
                prev.map((s) =>
                  s.id === ev.serverId
                    ? { ...s, status: ev.status, errorMessage: ev.errorMessage ?? null }
                    : s,
                ),
              );
            } catch {
              /* ignore malformed event */
            }
          }
        }
      } catch {
        /* aborted or network error; the panel keeps its last snapshot */
      }
    })();
    return () => ctrl.abort();
  }, []);

  const create = async (input: CreateMcpServerInput) => {
    try {
      await apiSend('/api/mcp/servers', input);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = (id: string) => setPendingDeleteId(id);

  const confirmRemove = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    try {
      await apiSend(`/api/mcp/servers/${id}`, null, 'DELETE');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const restart = async (id: string) => {
    try {
      await apiSend(`/api/mcp/servers/${id}/restart`, {});
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const setPolicy = async (id: string, tool: string, policy: McpPolicy) => {
    try {
      await apiSend(`/api/mcp/servers/${id}/tools/${encodeURIComponent(tool)}`, { policy }, 'PUT');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleDisabled = async (s: McpServerView) => {
    try {
      await apiSend(`/api/mcp/servers/${s.id}`, { disabled: !s.disabled }, 'PUT');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const fetchLog = async (id: string) => {
    try {
      const r = await apiGet<{ lines: string[] }>(`/api/mcp/servers/${id}/log`);
      setLogs((prev) => ({ ...prev, [id]: r.lines }));
    } catch (e) {
      setLogs((prev) => ({ ...prev, [id]: [`error: ${(e as Error).message}`] }));
    }
  };

  return (
    <>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <AddMcpForm onAdd={create} />
      {loading ? (
        <Spinner size="tiny" />
      ) : servers.length === 0 ? (
        <Text italic size={200}>
          {t('settings.mcpNoServers')}
        </Text>
      ) : (
        servers.map((s) => (
          <McpServerCard
            key={s.id}
            server={s}
            log={logs[s.id]}
            onRemove={() => remove(s.id)}
            onRestart={() => restart(s.id)}
            onToggleDisabled={() => toggleDisabled(s)}
            onPolicyChange={(tool, p) => setPolicy(s.id, tool, p)}
            onFetchLog={() => fetchLog(s.id)}
          />
        ))
      )}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={t('settings.mcpRemoveTitle', { label: pendingDeleteLabel })}
        body={t('settings.mcpRemoveBody')}
        confirmLabel={t('settings.mcpRemoveConfirm')}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function AddMcpForm({ onAdd }: { onAdd: (input: CreateMcpServerInput) => void }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'streamable-http'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');

  if (!open) {
    return (
      <Button appearance="primary" icon={<Add24Regular />} onClick={() => setOpen(true)}>
        {t('settings.mcpAddButton')}
      </Button>
    );
  }

  const submit = () => {
    if (!label.trim()) return;
    let spec: CreateMcpServerInput['spec'];
    if (transport === 'stdio') {
      if (!command.trim()) return;
      spec = {
        transport: 'stdio',
        command: command.trim(),
        args: args.trim() ? args.trim().split(/\s+/) : [],
        env: {},
      };
    } else {
      if (!url.trim()) return;
      spec = {
        transport,
        url: url.trim(),
        headers: {},
      };
    }
    onAdd({
      label: label.trim(),
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec,
    });
    setOpen(false);
    setLabel('');
    setCommand('');
    setArgs('');
    setUrl('');
  };

  return (
    <div className={styles.card}>
      <Text weight="semibold">{t('settings.mcpAddTitle')}</Text>
      <Field label={t('settings.mcpLabelField')}>
        <Input value={label} onChange={(_, d) => setLabel(d.value)} />
      </Field>
      <Field label={t('settings.mcpTransportLabel')}>
        <Select value={transport} onChange={(_, d) => setTransport(d.value as any)}>
          <option value="stdio">stdio</option>
          <option value="sse">SSE</option>
          <option value="streamable-http">streamable-http</option>
        </Select>
      </Field>
      {transport === 'stdio' ? (
        <>
          <Field label={t('settings.mcpCommandLabel')}>
            <Input
              value={command}
              onChange={(_, d) => setCommand(d.value)}
              placeholder={t('settings.mcpCommandPlaceholder')}
            />
          </Field>
          <Field label={t('settings.mcpArgsLabel')}>
            <Input
              value={args}
              onChange={(_, d) => setArgs(d.value)}
              placeholder={t('settings.mcpArgsPlaceholder')}
            />
          </Field>
        </>
      ) : (
        <Field label={t('settings.mcpUrlLabel')}>
          <Input
            value={url}
            onChange={(_, d) => setUrl(d.value)}
            placeholder={t('settings.mcpUrlPlaceholder')}
          />
        </Field>
      )}
      <div className={styles.row}>
        <Button appearance="primary" onClick={submit}>
          {t('common.save')}
        </Button>
        <Button appearance="subtle" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}

function McpServerCard({
  server,
  log,
  onRemove,
  onRestart,
  onToggleDisabled,
  onPolicyChange,
  onFetchLog,
}: {
  server: McpServerView;
  log: string[] | undefined;
  onRemove: () => void;
  onRestart: () => void;
  onToggleDisabled: () => void;
  onPolicyChange: (tool: string, p: McpPolicy) => void;
  onFetchLog: () => void;
}) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{server.label}</span>
        <Badge appearance="filled" color={STATUS_BADGE[server.status]} size="small">
          {server.status}
        </Badge>
        <Button
          appearance="subtle"
          size="small"
          icon={<ArrowClockwise24Regular />}
          onClick={onRestart}
          aria-label={t('settings.mcpRestartAria', { label: server.label })}
        />
        <Button
          appearance="subtle"
          size="small"
          icon={<Delete24Regular />}
          onClick={onRemove}
          aria-label={t('settings.mcpRemoveAria', { label: server.label })}
        />
      </div>
      {server.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {server.errorMessage}
        </Text>
      )}
      <div className={styles.row}>
        <Switch
          checked={!server.disabled}
          onChange={onToggleDisabled}
          label={server.disabled ? t('settings.mcpDisabled') : t('settings.mcpEnabled')}
        />
        <Text size={200}>{t('settings.mcpDefault', { policy: server.defaultPolicy })}</Text>
      </div>
      {server.tools.length > 0 && (
        <>
          <Text weight="semibold" size={200}>
            {t('settings.mcpTools')}
          </Text>
          {server.tools.map((tool) => (
            <div key={tool.name} className={styles.toolRow}>
              <span className={styles.toolName} title={tool.name}>
                {tool.name}
              </span>
              <Select
                value={tool.policy}
                onChange={(_, d) => onPolicyChange(tool.name, d.value as McpPolicy)}
                aria-label={t('settings.mcpPolicyAria', { tool: tool.name })}
                size="small"
              >
                <option value="allow">allow</option>
                <option value="ask">ask</option>
                <option value="deny">deny</option>
              </Select>
            </div>
          ))}
        </>
      )}
      <div className={styles.row}>
        <Button appearance="subtle" size="small" onClick={onFetchLog}>
          {t('settings.mcpShowLog')}
        </Button>
      </div>
      {log && (
        <div className={styles.logBox} aria-label={t('settings.mcpLogAria', { label: server.label })}>
          {log.length === 0 ? t('settings.mcpLogEmpty') : log.join('\n')}
        </div>
      )}
    </div>
  );
}
