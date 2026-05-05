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
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Add24Regular,
  Delete24Regular,
  ArrowClockwise24Regular,
  Eye24Regular,
  EyeOff24Regular,
} from '@fluentui/react-icons';
import { apiGet, apiSend, getToken } from '../api.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import type {
  Settings,
  ProviderConfig,
  ProviderKind,
  McpServerView,
  McpPolicy,
  CreateProviderInput,
  CreateMcpServerInput,
  McpStatus,
} from '@autooffice/shared';
import { getKnownModels, isCliBridge } from '@autooffice/shared';

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
  notice: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    backgroundColor: tokens.colorPaletteYellowBackground1,
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    color: tokens.colorPaletteDarkOrangeForeground1,
    borderRadius: '4px',
  },
  noticeText: {
    flex: 1,
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
  { value: 'claude-code', label: 'Claude Code (CLI)' },
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

type TabKey = 'global' | 'providers' | 'mcp';

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const styles = useStyles();
  const [tab, setTab] = useState<TabKey>('global');

  return (
    <div className={styles.container} role="dialog" aria-label="Settings">
      <div className={styles.header}>
        <Button
          appearance="subtle"
          icon={<Dismiss24Regular />}
          onClick={onClose}
          aria-label="Close settings"
        />
        <Text weight="semibold">Settings</Text>
      </div>
      <div className={styles.tabs}>
        <TabList
          selectedValue={tab}
          onTabSelect={(_, d) => setTab(d.value as TabKey)}
          size="small"
        >
          <Tab value="global">Global</Tab>
          <Tab value="providers">Providers</Tab>
          <Tab value="mcp">MCP</Tab>
        </TabList>
      </div>
      <div className={styles.body}>
        {tab === 'global' && <GlobalSection onGoToProviders={() => setTab('providers')} />}
        {tab === 'providers' && <ProvidersSection />}
        {tab === 'mcp' && <McpSection />}
      </div>
    </div>
  );
}

// ─────────────────────────── Global ───────────────────────────

function GlobalSection({ onGoToProviders }: { onGoToProviders: () => void }) {
  const styles = useStyles();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        apiGet<Settings>('/api/settings'),
        apiGet<ProviderConfig[]>('/api/providers'),
      ]);
      setSettings(s);
      setProviders(p);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const update = async (patch: Partial<Settings>) => {
    if (!settings) return;
    try {
      const next = await apiSend<Settings>('/api/settings', patch, 'PUT');
      setSettings(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!settings) {
    return error ? <div className={styles.errorBanner}>{error}</div> : <Spinner size="tiny" />;
  }

  return (
    <>
      {error && <div className={styles.errorBanner}>{error}</div>}
      {providers.length === 0 && (
        <div className={styles.notice} role="status">
          <Text className={styles.noticeText} size={200}>
            No AI provider is configured yet. Add one to start chatting.
          </Text>
          <Button appearance="primary" size="small" onClick={onGoToProviders}>
            Add provider
          </Button>
        </div>
      )}
      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          Active provider
        </Text>
        <Field label="Provider">
          <Select
            value={settings.selectedProviderId ?? ''}
            onChange={(_, d) =>
              void update({
                selectedProviderId: d.value || null,
                // reset model when provider changes
                selectedModelId: null,
              })
            }
          >
            <option value="">— None —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.kind})
              </option>
            ))}
          </Select>
        </Field>
        <ModelField
          providerId={settings.selectedProviderId}
          providerKind={
            providers.find((p) => p.id === settings.selectedProviderId)?.kind ?? null
          }
          value={settings.selectedModelId ?? ''}
          onChange={(v) => void update({ selectedModelId: v || null })}
        />
      </div>

      <Divider />

      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          Execution
        </Text>
        <Field label="Auto-approve code execution">
          <Switch
            checked={settings.autoApprove}
            onChange={(_, d) => void update({ autoApprove: d.checked })}
          />
        </Field>
        <Field label="Max steps per turn">
          <Input
            type="number"
            value={String(settings.maxSteps)}
            onChange={(_, d) => {
              const n = parseInt(d.value, 10);
              if (!Number.isNaN(n)) void update({ maxSteps: n });
            }}
            min={1}
            max={50}
          />
        </Field>
      </div>

      <Divider />

      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          Locale
        </Text>
        <Field label="Locale">
          <Input
            value={settings.locale}
            onChange={(_, d) => void update({ locale: d.value })}
            placeholder="en"
          />
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
        setHint(r.source === 'fallback' ? r.message ?? 'using built-in model list' : null);
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
  }, [providerId, providerKind]);

  const hintText =
    source === 'live'
      ? `${suggestions.length} models from provider`
      : hint ?? 'Pick a known model or type your own';

  if (suggestions.length === 0) {
    return (
      <Field label="Model id" hint={hint ?? undefined}>
        <Input
          value={draft}
          onChange={(_, d) => setDraft(d.value)}
          onBlur={() => {
            if (draft !== value) onChange(draft);
          }}
          placeholder="e.g. claude-opus-4-7"
        />
      </Field>
    );
  }

  return (
    <Field label="Model id" hint={hintText}>
      <Combobox
        freeform
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
        placeholder="e.g. claude-opus-4-7"
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

function ProvidersSection() {
  const styles = useStyles();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteLabel =
    providers.find((p) => p.id === pendingDeleteId)?.label ?? 'this provider';

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setProviders(await apiGet<ProviderConfig[]>('/api/providers'));
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

  const addProvider = async (input: CreateProviderInput) => {
    try {
      await apiSend('/api/providers', input);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeProvider = (id: string) => setPendingDeleteId(id);

  const confirmRemoveProvider = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    try {
      await apiSend(`/api/providers/${id}`, null, 'DELETE');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateProvider = async (id: string, patch: { label?: string; apiKey?: string }) => {
    try {
      await apiSend(`/api/providers/${id}`, patch, 'PUT');
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const testProvider = async (id: string) => {
    try {
      const r = await apiSend<{ status: string; message?: string }>(
        `/api/providers/${id}/test`,
        {},
      );
      setTestResults((prev) => ({
        ...prev,
        [id]: r.message ? `${r.status}: ${r.message}` : r.status,
      }));
    } catch (e) {
      setTestResults((prev) => ({ ...prev, [id]: `error: ${(e as Error).message}` }));
    }
  };

  return (
    <>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <AddProviderForm onAdd={addProvider} />
      <Divider />
      {loading ? (
        <Spinner size="tiny" />
      ) : providers.length === 0 ? (
        <Text italic size={200}>
          No providers configured.
        </Text>
      ) : (
        providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            testResult={testResults[p.id]}
            onUpdate={(patch) => updateProvider(p.id, patch)}
            onRemove={() => removeProvider(p.id)}
            onTest={() => testProvider(p.id)}
          />
        ))
      )}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={`Remove ${pendingDeleteLabel}?`}
        body="The stored API key will be removed."
        confirmLabel="Remove"
        onConfirm={() => void confirmRemoveProvider()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function AddProviderForm({ onAdd }: { onAdd: (input: CreateProviderInput) => void }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ProviderKind>('anthropic');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  // CLI-bridge specific config
  const [binaryPath, setBinaryPath] = useState('');
  const [geminiAuthType, setGeminiAuthType] = useState<'oauth-personal' | 'gemini-api-key'>(
    'oauth-personal',
  );
  const [opencodeHostname, setOpencodeHostname] = useState('');
  const [opencodePort, setOpencodePort] = useState('');

  if (!open) {
    return (
      <Button appearance="primary" icon={<Add24Regular />} onClick={() => setOpen(true)}>
        Add provider
      </Button>
    );
  }

  const reset = () => {
    setLabel('');
    setApiKey('');
    setBinaryPath('');
    setGeminiAuthType('oauth-personal');
    setOpencodeHostname('');
    setOpencodePort('');
  };

  const submit = () => {
    if (!label.trim()) return;
    const input: CreateProviderInput = {
      kind,
      label: label.trim(),
    };
    if (kind === 'claude-code') {
      if (binaryPath.trim()) input.config = { binaryPath: binaryPath.trim() };
    } else if (kind === 'gemini-cli') {
      input.config = { authType: geminiAuthType };
      if (geminiAuthType === 'gemini-api-key' && apiKey.trim()) {
        input.config.apiKey = apiKey.trim();
      }
    } else if (kind === 'opencode') {
      const cfg: Record<string, unknown> = {};
      if (opencodeHostname.trim()) cfg.hostname = opencodeHostname.trim();
      if (opencodePort.trim()) {
        const port = parseInt(opencodePort.trim(), 10);
        if (!Number.isNaN(port)) cfg.port = port;
      }
      if (Object.keys(cfg).length > 0) input.config = cfg;
    } else if (apiKey.trim()) {
      input.apiKey = apiKey.trim();
    }
    onAdd(input);
    setOpen(false);
    reset();
  };

  const cli = isCliBridge(kind);

  return (
    <div className={styles.card}>
      <Text weight="semibold">Add provider</Text>
      <Field label="Kind">
        <Select value={kind} onChange={(_, d) => setKind(d.value as ProviderKind)}>
          {PROVIDER_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Label">
        <Input
          value={label}
          onChange={(_, d) => setLabel(d.value)}
          placeholder="My provider"
        />
      </Field>

      {kind === 'claude-code' && (
        <Field label="Path to claude binary (optional)" hint="Defaults to `claude` on PATH">
          <Input
            value={binaryPath}
            onChange={(_, d) => setBinaryPath(d.value)}
            placeholder="/usr/local/bin/claude"
          />
        </Field>
      )}

      {kind === 'gemini-cli' && (
        <>
          <Field label="Auth" hint="OAuth uses ~/.gemini/oauth_creds.json from `gemini` setup">
            <Select
              value={geminiAuthType}
              onChange={(_, d) =>
                setGeminiAuthType(d.value as 'oauth-personal' | 'gemini-api-key')
              }
            >
              <option value="oauth-personal">OAuth (personal)</option>
              <option value="gemini-api-key">Gemini API key</option>
            </Select>
          </Field>
          {geminiAuthType === 'gemini-api-key' && (
            <Field label="Gemini API key">
              <Input
                type="password"
                value={apiKey}
                onChange={(_, d) => setApiKey(d.value)}
                placeholder="AI..."
              />
            </Field>
          )}
        </>
      )}

      {kind === 'opencode' && (
        <>
          <Field label="Hostname (optional)" hint="Defaults to 127.0.0.1; auto-starts the server">
            <Input
              value={opencodeHostname}
              onChange={(_, d) => setOpencodeHostname(d.value)}
              placeholder="127.0.0.1"
            />
          </Field>
          <Field label="Port (optional)" hint="Defaults to 4096">
            <Input
              type="number"
              value={opencodePort}
              onChange={(_, d) => setOpencodePort(d.value)}
              placeholder="4096"
            />
          </Field>
        </>
      )}

      {!cli && (
        <Field label="API key">
          <Input
            type="password"
            value={apiKey}
            onChange={(_, d) => setApiKey(d.value)}
            placeholder="sk-..."
          />
        </Field>
      )}

      <div className={styles.row}>
        <Button appearance="primary" onClick={submit}>
          Save
        </Button>
        <Button
          appearance="subtle"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  testResult,
  onUpdate,
  onRemove,
  onTest,
}: {
  provider: ProviderConfig;
  testResult: string | undefined;
  onUpdate: (patch: { label?: string; apiKey?: string }) => void;
  onRemove: () => void;
  onTest: () => void;
}) {
  const styles = useStyles();
  const [label, setLabel] = useState(provider.label);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          {provider.label} <Text size={200}>({provider.kind})</Text>
        </span>
        <Badge appearance="outline" size="small" color={provider.hasKey ? 'success' : 'warning'}>
          {provider.hasKey ? 'has key' : 'no key'}
        </Badge>
        <Badge appearance="outline" size="small">
          {provider.status}
        </Badge>
        <Button
          appearance="subtle"
          size="small"
          onClick={onTest}
          aria-label={`Test ${provider.label}`}
        >
          Test
        </Button>
        <Button
          appearance="subtle"
          size="small"
          icon={<Delete24Regular />}
          aria-label={`Remove ${provider.label}`}
          onClick={onRemove}
        />
      </div>
      {testResult && (
        <Text size={200} italic>
          Test result: {testResult}
        </Text>
      )}
      {!editing ? (
        <Button appearance="subtle" size="small" onClick={() => setEditing(true)}>
          Edit
        </Button>
      ) : (
        <>
          <Field label="Label">
            <Input value={label} onChange={(_, d) => setLabel(d.value)} />
          </Field>
          <Field label="New API key (leave blank to keep)">
            <div className={styles.row}>
              <Input
                style={{ flex: 1 }}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(_, d) => setApiKey(d.value)}
                placeholder="sk-..."
              />
              <Button
                appearance="subtle"
                icon={showKey ? <EyeOff24Regular /> : <Eye24Regular />}
                onClick={() => setShowKey((s) => !s)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
              />
            </div>
          </Field>
          <div className={styles.row}>
            <Button
              appearance="primary"
              onClick={() => {
                const patch: { label?: string; apiKey?: string } = {};
                if (label !== provider.label) patch.label = label;
                if (apiKey.trim()) patch.apiKey = apiKey.trim();
                if (Object.keys(patch).length > 0) onUpdate(patch);
                setEditing(false);
                setApiKey('');
              }}
            >
              Save
            </Button>
            <Button
              appearance="subtle"
              onClick={() => {
                setEditing(false);
                setLabel(provider.label);
                setApiKey('');
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────── MCP ───────────────────────────

type StatusEvent = { serverId: string; status: McpStatus; errorMessage?: string | null; toolCount?: number };

function McpSection() {
  const styles = useStyles();
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
      <Divider />
      {loading ? (
        <Spinner size="tiny" />
      ) : servers.length === 0 ? (
        <Text italic size={200}>
          No MCP servers configured.
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
        title={`Remove MCP server ${pendingDeleteLabel}?`}
        body="The server will be disconnected and forgotten."
        confirmLabel="Remove"
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function AddMcpForm({ onAdd }: { onAdd: (input: CreateMcpServerInput) => void }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [transport, setTransport] = useState<'stdio' | 'sse' | 'streamable-http'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');

  if (!open) {
    return (
      <Button appearance="primary" icon={<Add24Regular />} onClick={() => setOpen(true)}>
        Add MCP server
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
      <Text weight="semibold">Add MCP server</Text>
      <Field label="Label">
        <Input value={label} onChange={(_, d) => setLabel(d.value)} />
      </Field>
      <Field label="Transport">
        <Select value={transport} onChange={(_, d) => setTransport(d.value as any)}>
          <option value="stdio">stdio</option>
          <option value="sse">SSE</option>
          <option value="streamable-http">streamable-http</option>
        </Select>
      </Field>
      {transport === 'stdio' ? (
        <>
          <Field label="Command">
            <Input value={command} onChange={(_, d) => setCommand(d.value)} placeholder="node" />
          </Field>
          <Field label="Args (space-separated)">
            <Input value={args} onChange={(_, d) => setArgs(d.value)} placeholder="server.js" />
          </Field>
        </>
      ) : (
        <Field label="URL">
          <Input
            value={url}
            onChange={(_, d) => setUrl(d.value)}
            placeholder="https://server-url/mcp"
          />
        </Field>
      )}
      <div className={styles.row}>
        <Button appearance="primary" onClick={submit}>
          Save
        </Button>
        <Button appearance="subtle" onClick={() => setOpen(false)}>
          Cancel
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
          aria-label={`Restart ${server.label}`}
        />
        <Button
          appearance="subtle"
          size="small"
          icon={<Delete24Regular />}
          onClick={onRemove}
          aria-label={`Remove ${server.label}`}
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
          label={server.disabled ? 'Disabled' : 'Enabled'}
        />
        <Text size={200}>Default: {server.defaultPolicy}</Text>
      </div>
      {server.tools.length > 0 && (
        <>
          <Text weight="semibold" size={200}>
            Tools
          </Text>
          {server.tools.map((tool) => (
            <div key={tool.name} className={styles.toolRow}>
              <span className={styles.toolName} title={tool.name}>
                {tool.name}
              </span>
              <Select
                value={tool.policy}
                onChange={(_, d) => onPolicyChange(tool.name, d.value as McpPolicy)}
                aria-label={`Policy for ${tool.name}`}
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
          Show stderr log
        </Button>
      </div>
      {log && (
        <div className={styles.logBox} aria-label={`stderr log for ${server.label}`}>
          {log.length === 0 ? '(empty)' : log.join('\n')}
        </div>
      )}
    </div>
  );
}
