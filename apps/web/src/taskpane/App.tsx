import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { useChat } from '@ai-sdk/react';
import {
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import type { HostContext } from './host/context.ts';
import { ChatPanel } from './components/ChatPanel.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { useHighlightCode } from './components/CodeBlock.tsx';
import { Sandbox } from './executor/sandbox.ts';
import { bootstrap, apiGet, apiSend } from './api.ts';
import { makeChatTransport } from './chat/transport.ts';
import { makeOnToolCall } from './chat/on-tool-call.ts';
import type { Settings, Message } from '@autooffice/shared';
import { detectLegacy } from './legacy/detect.ts';
import { pack } from './legacy/pack.ts';
import { LegacyImportModal } from './components/LegacyImportModal.tsx';
import { useTranslation, isLocaleId } from './i18n/index.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
    position: 'relative',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  drawer: {
    position: 'absolute',
    inset: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
  },
});

interface AppProps {
  host: HostContext;
}

export function App({ host }: AppProps) {
  const styles = useStyles();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingLegacy, setPendingLegacy] = useState<ReturnType<typeof pack> | null>(null);

  useEffect(() => {
    const blob = detectLegacy();
    setPendingLegacy(pack(blob));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await bootstrap();
        const s = await apiGet<Settings>('/api/settings');
        // Always start with a fresh, empty chat when the task pane opens —
        // we don't want chats from other documents to leak in. Older
        // conversations are still reachable via the History panel.
        const created = await apiSend<{ id: string }>('/api/conversations', { host: host.kind });
        if (cancelled) return;
        setSettings(s);
        setConversationId(created.id);
        setInitialMessages([]);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [host.kind]);

  const loadConversation = useCallback(async (id: string) => {
    const conv = await apiGet<{ conversation: { id: string }; messages: Message[] }>(
      `/api/conversations/${id}`,
    );
    setConversationId(id);
    setInitialMessages(conv.messages);
  }, []);

  const createConversation = useCallback(async () => {
    const created = await apiSend<{ id: string }>('/api/conversations', { host: host.kind });
    await loadConversation(created.id);
  }, [host.kind, loadConversation]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await apiGet<Settings>('/api/settings');
      setSettings(s);
    } catch {
      /* keep last-known settings on transient failure */
    }
  }, []);

  // The server's settings.locale is the source of truth. Push it into the
  // LanguageProvider whenever the *server* value changes (boot-time and after
  // settings refresh). Do NOT re-fire on activeLocale changes — SettingsPanel
  // calls setLocale() directly the moment the user picks a language, and App's
  // settings copy doesn't update until refreshSettings() runs on drawer close.
  // Keying on activeLocale would compare a fresh provider locale against a
  // stale server locale and revert the user's choice until the drawer closes.
  const { setLocale } = useTranslation();
  useEffect(() => {
    const next = settings?.locale;
    if (!next || !isLocaleId(next)) return;
    void setLocale(next);
  }, [settings?.locale, setLocale]);

  if (error) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>Failed to start: {error}</div>
      </div>
    );
  }
  if (!ready || !settings || !conversationId) {
    return (
      <div className={styles.root}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (pendingLegacy) {
    return <LegacyImportModal payload={pendingLegacy} onDone={() => setPendingLegacy(null)} />;
  }

  return (
    <div className={styles.root}>
      <ChatScreen
        key={conversationId}
        host={host}
        conversationId={conversationId}
        initialMessages={initialMessages}
        settings={settings}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onNewChat={() => {
          void createConversation();
        }}
      />
      {settingsOpen && (
        <div className={styles.drawer}>
          <SettingsPanel
            onClose={() => {
              setSettingsOpen(false);
              void refreshSettings();
            }}
          />
        </div>
      )}
      {historyOpen && (
        <div className={styles.drawer}>
          <HistoryPanel
            currentHost={host.kind}
            activeConversationId={conversationId}
            onSelectConversation={(id) => {
              void loadConversation(id);
              setHistoryOpen(false);
            }}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function ChatScreen({
  host,
  conversationId,
  initialMessages,
  settings,
  onOpenSettings,
  onOpenHistory,
  onNewChat,
}: {
  host: HostContext;
  conversationId: string;
  initialMessages: Message[];
  settings: Settings;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onNewChat: () => void;
}) {
  const sandbox = useMemo(() => new Sandbox(host.kind), [host.kind]);
  useEffect(() => {
    sandbox.init();
    return () => sandbox.destroy();
  }, [sandbox]);

  // useChat captures the transport on first render and never swaps it. Route
  // current provider/model selection through a ref so a single transport
  // instance always reads the latest values.
  const selectionRef = useRef({
    providerId: settings.selectedProviderId ?? '',
    modelId: settings.selectedModelId ?? '',
  });
  selectionRef.current = {
    providerId: settings.selectedProviderId ?? '',
    modelId: settings.selectedModelId ?? '',
  };

  const transport = useMemo(
    () =>
      makeChatTransport({
        host: host.kind,
        getProviderId: () => selectionRef.current.providerId,
        getModelId: () => selectionRef.current.modelId,
      }),
    [host.kind],
  );

  const runInIframe = async (code: string): Promise<unknown> => {
    const result = await sandbox.execute(code);
    if (!result.success) {
      throw new Error(result.error ?? 'execution failed');
    }
    return { output: result.output, logs: result.logs };
  };

  const { messages, sendMessage, status, error, addToolOutput, addToolApprovalResponse } = useChat({
    id: conversationId,
    messages: initialMessages as any,
    transport,
    sendAutomaticallyWhen: (msgs: any) =>
      lastAssistantMessageIsCompleteWithToolCalls(msgs) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(msgs),
    onToolCall: makeOnToolCall({
      runInIframe,
      addToolOutput: (a) => addToolOutput(a as any),
      isAutoApprove: () => settings.autoApprove,
    }),
  });

  const noProvider = !settings.selectedProviderId;

  const highlightCode = useHighlightCode();

  return (
    <ChatPanel
      host={host}
      messages={messages as any}
      status={status as any}
      noProvider={noProvider}
      chatError={error ? error.message : null}
      onSubmit={(text) => sendMessage({ text })}
      onApproveCode={async (toolCallId, code) => {
        try {
          const output = await runInIframe(code);
          addToolOutput({ tool: 'execute_code', toolCallId, output } as any);
        } catch (err) {
          addToolOutput({
            tool: 'execute_code',
            toolCallId,
            state: 'output-error',
            errorText: (err as Error).message,
          } as any);
        }
      }}
      onRejectCode={(toolCallId) =>
        addToolOutput({
          tool: 'execute_code',
          toolCallId,
          state: 'output-error',
          errorText: 'User rejected',
        } as any)
      }
      onApprovalResponse={(id, approved) => addToolApprovalResponse({ id, approved })}
      highlightCode={highlightCode}
      onOpenSettings={onOpenSettings}
      onOpenHistory={onOpenHistory}
      onNewChat={onNewChat}
    />
  );
}
