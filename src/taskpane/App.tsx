import React, { useState, useCallback, useRef, useEffect } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import type { ModelMessage } from 'ai';
import type { HostContext, HostKind } from './host/context.ts';
import { ChatPanel } from './components/ChatPanel.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { HistoryPanel } from './components/HistoryPanel.tsx';
import { runAgent, type ChatMessage, type OrchestratorCallbacks } from './agent/orchestrator.ts';
import { generateTitle } from './agent/title.ts';
import { Sandbox } from './executor/sandbox.ts';
import { formatError } from './agent/errors.ts';
import { loadSettings, saveSettings, type AppSettings } from './store/settings.ts';
import {
  saveConversation,
  getConversation,
  listConversations,
  renameConversation,
  deleteConversation,
  mostRecentForHost,
  CURRENT_VERSION,
  type Conversation,
  type ConversationSummary,
} from './store/history.ts';
import { translationService } from './i18n/index.ts';
import { sumCallCosts, emptyCallCost, isCallCostEmpty, type CallCost } from './agent/pricing.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
});

const SAVE_DEBOUNCE_MS = 300;
const PLACEHOLDER_LEN = 40;

function placeholderTitle(firstUserMessage: string): string {
  const oneLine = firstUserMessage.replace(/\s+/g, ' ').trim();
  if (!oneLine) return translationService.t('history.newChatPlaceholder');
  return oneLine.length <= PLACEHOLDER_LEN ? oneLine : oneLine.slice(0, PLACEHOLDER_LEN);
}

interface AppProps {
  host: HostContext;
}

export function App({ host }: AppProps) {
  const styles = useStyles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeChatHost, setActiveChatHost] = useState<HostKind | null>(null);
  const [activeCost, setActiveCost] = useState<CallCost | undefined>(undefined);
  const [historySummaries, setHistorySummaries] = useState<ConversationSummary[]>(() => listConversations());

  const conversationHistory = useRef<ModelMessage[]>([]);
  const sandboxRef = useRef<Sandbox | null>(null);
  const approvalResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate the most recent conversation for this host on mount.
  useEffect(() => {
    const recent = mostRecentForHost(host.kind);
    if (!recent) return;
    const conv = getConversation(recent.id);
    if (!conv) return;
    setMessages(conv.uiMessages);
    conversationHistory.current = conv.modelMessages;
    setActiveConversationId(conv.id);
    setActiveChatHost(conv.host);
    setActiveCost(conv.cost);
  }, [host.kind]);

  useEffect(() => {
    const sandbox = new Sandbox(host.kind);
    sandbox.init();
    sandboxRef.current = sandbox;
    return () => sandbox.destroy();
  }, [host.kind]);

  const refreshSummaries = useCallback(() => {
    setHistorySummaries(listConversations());
  }, []);

  const persistDebounced = useCallback((conv: Conversation) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConversation(conv);
      refreshSummaries();
    }, SAVE_DEBOUNCE_MS);
  }, [refreshSummaries]);

  const persistImmediate = useCallback((conv: Conversation) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveConversation(conv);
    refreshSummaries();
  }, [refreshSummaries]);

  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handleApprove = useCallback((approved: boolean) => {
    if (approvalResolveRef.current) {
      approvalResolveRef.current(approved);
      approvalResolveRef.current = null;
      setPendingApproval(null);
    }
  }, []);

  // Cancel any pending debounced save. The pending callback closes over an
  // older Conversation object that, if allowed to fire, would write stale data
  // (potentially under a different active id after the user switches/clears).
  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const handleNewChat = useCallback(() => {
    if (isLoading) return;
    cancelPendingSave();
    setMessages([]);
    conversationHistory.current = [];
    setActiveConversationId(null);
    setActiveChatHost(null);
    setActiveCost(undefined);
  }, [isLoading, cancelPendingSave]);

  const handleLoadConversation = useCallback((id: string) => {
    if (isLoading) return;
    const conv = getConversation(id);
    if (!conv) return;
    cancelPendingSave();
    setMessages(conv.uiMessages);
    conversationHistory.current = conv.modelMessages;
    setActiveConversationId(conv.id);
    setActiveChatHost(conv.host);
    setActiveCost(conv.cost);
    setShowHistory(false);
  }, [isLoading, cancelPendingSave]);

  const handleRename = useCallback((id: string, title: string) => {
    renameConversation(id, title);
    refreshSummaries();
  }, [refreshSummaries]);

  const handleDelete = useCallback((id: string) => {
    deleteConversation(id);
    if (id === activeConversationId) {
      cancelPendingSave();
      setMessages([]);
      conversationHistory.current = [];
      setActiveConversationId(null);
      setActiveChatHost(null);
      setActiveCost(undefined);
    }
    refreshSummaries();
  }, [activeConversationId, cancelPendingSave, refreshSummaries]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Decide on (or create) the active conversation up front so we know its id
    // before runAgent appends new turn messages. Use the latest UI messages
    // captured *before* this user message, so first-turn detection is correct.
    let convId = activeConversationId;
    let convHost: HostKind = activeChatHost ?? host.kind;
    let isFirstTurn = false;
    if (convId === null) {
      convId = crypto.randomUUID();
      convHost = host.kind;
      isFirstTurn = true;
      setActiveConversationId(convId);
      setActiveChatHost(convHost);
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    let turnCost: CallCost | null = null;

    const callbacks: OrchestratorCallbacks = {
      onMessage: (msg) => setMessages(prev => [...prev, msg]),
      onTurnCost: (cost) => { turnCost = cost; },
      onStreamToken: (token) => {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant' && !last.codeBlock && !last.toolActivity) {
            copy[copy.length - 1] = { ...last, content: last.content + token };
          }
          return copy;
        });
      },
      onUpsertCodeBlock: (toolCallId, patch) => {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.codeBlock?.toolCallId === toolCallId);
          if (idx === -1) {
            return [...prev, {
              role: 'assistant',
              content: '',
              codeBlock: {
                toolCallId,
                code: patch.code ?? '',
                status: patch.status ?? 'streaming',
                result: patch.result,
              },
            }];
          }
          const copy = [...prev];
          const existing = copy[idx];
          copy[idx] = {
            ...existing,
            codeBlock: { ...existing.codeBlock!, ...patch },
          };
          return copy;
        });
      },
      requestApproval: (code) => {
        setPendingApproval(code);
        return new Promise<boolean>((resolve) => {
          approvalResolveRef.current = resolve;
        });
      },
    };

    // Compute the placeholder title up front so the title-gen block below
    // can rely on it without coordinating with the setMessages callback.
    const placeholder = isFirstTurn ? (placeholderTitle(text) || translationService.t('history.newChatPlaceholder')) : '';

    try {
      const history = await runAgent(
        text,
        conversationHistory.current,
        settings,
        sandboxRef.current!,
        host.kind,
        callbacks,
      );
      conversationHistory.current = history;
    } catch (e) {
      const formatted = formatError(e, { phase: 'agent' });
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: formatted }]);
    } finally {
      setIsLoading(false);
      setPendingApproval(null);
    }

    // Snapshot the latest in-memory state by reading back from setState.
    // First-turn saves go through immediately so the blob exists by the
    // time generateTitle resolves; later turns can debounce.
    setMessages(currentMessages => {
      const now = Date.now();
      const existing = isFirstTurn ? null : getConversation(convId!);
      // Use the in-memory activeCost as the running total rather than reading
      // from disk: the previous turn's save may still be inside its debounce
      // window. Skip the merge when the new turn-cost is empty (no tokens, no
      // $) so the source label isn't demoted by a no-op turn.
      const accumulatedCost = turnCost && !isCallCostEmpty(turnCost)
        ? sumCallCosts([activeCost ?? emptyCallCost('estimated'), turnCost])
        : activeCost;
      const conv: Conversation = {
        id: convId!,
        v: CURRENT_VERSION,
        title: isFirstTurn ? placeholder : (existing?.title ?? translationService.t('history.newChatPlaceholder')),
        host: convHost,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messageCount: currentMessages.length,
        uiMessages: currentMessages,
        modelMessages: conversationHistory.current,
        cost: accumulatedCost,
        totalUsd: accumulatedCost?.totalUsd,
        costSource: accumulatedCost?.source,
      };
      setActiveCost(accumulatedCost);
      if (isFirstTurn) persistImmediate(conv);
      else persistDebounced(conv);
      return currentMessages;
    });

    // Fire-and-forget LLM title generation on first turn only.
    if (isFirstTurn) {
      void generateTitle(conversationHistory.current, settings).then((newTitle) => {
        if (!newTitle) return;
        const current = getConversation(convId!);
        if (!current) return;
        // Race-safe: only overwrite if the title is still the placeholder we set.
        if (current.title !== placeholder) return;
        renameConversation(convId!, newTitle);
        refreshSummaries();
      });
    }
  }, [isLoading, settings, host, activeConversationId, activeChatHost, persistDebounced, persistImmediate, refreshSummaries]);

  if (showSettings) {
    return (
      <div className={styles.root}>
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className={styles.root}>
        <HistoryPanel
          conversations={historySummaries}
          currentHost={host.kind}
          activeId={activeConversationId}
          onSelect={handleLoadConversation}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <ChatPanel
        host={host}
        messages={messages}
        isLoading={isLoading}
        pendingApproval={pendingApproval}
        activeChatHost={activeChatHost}
        cost={activeCost}
        onSend={handleSend}
        onApprove={handleApprove}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHistory={() => setShowHistory(true)}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
