import React, { useState, useCallback, useRef, useEffect } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import type { ModelMessage } from 'ai';
import type { HostContext } from './host/context.ts';
import { ChatPanel } from './components/ChatPanel.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { runAgent, type ChatMessage, type OrchestratorCallbacks } from './agent/orchestrator.ts';
import { Sandbox } from './executor/sandbox.ts';
import { loadSettings, saveSettings, type AppSettings } from './store/settings.ts';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: 'hidden',
  },
});

interface AppProps {
  host: HostContext;
}

export function App({ host }: AppProps) {
  const styles = useStyles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [pendingApproval, setPendingApproval] = useState<string | null>(null);

  const conversationHistory = useRef<ModelMessage[]>([]);
  const sandboxRef = useRef<Sandbox | null>(null);
  const approvalResolveRef = useRef<((approved: boolean) => void) | null>(null);

  useEffect(() => {
    const sandbox = new Sandbox();
    sandbox.init();
    sandboxRef.current = sandbox;
    return () => sandbox.destroy();
  }, []);

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

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    const callbacks: OrchestratorCallbacks = {
      onMessage: (msg) => setMessages(prev => [...prev, msg]),
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
      requestApproval: (code) => {
        setPendingApproval(code);
        return new Promise<boolean>((resolve) => {
          approvalResolveRef.current = resolve;
        });
      },
    };

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
      const errorMsg = e instanceof Error ? e.message : String(e);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
      setPendingApproval(null);
    }
  }, [isLoading, settings, host]);

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

  return (
    <div className={styles.root}>
      <ChatPanel
        messages={messages}
        isLoading={isLoading}
        pendingApproval={pendingApproval}
        onSend={handleSend}
        onApprove={handleApprove}
        onOpenSettings={() => setShowSettings(true)}
      />
    </div>
  );
}
