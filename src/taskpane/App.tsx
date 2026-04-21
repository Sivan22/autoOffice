import React, { useState, useCallback, useRef, useEffect } from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import type { CoreMessage } from 'ai';
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

export function App() {
  const styles = useStyles();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [streamingText, setStreamingText] = useState('');

  const conversationHistory = useRef<CoreMessage[]>([]);
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
    }
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingText('');

    const callbacks: OrchestratorCallbacks = {
      onMessage: (msg) => {
        setMessages(prev => [...prev, msg]);
        setStreamingText('');
      },
      onUpdateLastMessage: (update) => {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, ...update };
          return copy;
        });
      },
      onStreamToken: (token) => {
        setStreamingText(prev => prev + token);
        // Also update the last message's content
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: last.content + token };
          }
          return copy;
        });
      },
      requestApproval: (code) => {
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
        callbacks,
      );
      conversationHistory.current = history;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  }, [isLoading, settings]);

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
        onSend={handleSend}
        onApprove={handleApprove}
        onOpenSettings={() => setShowSettings(true)}
      />
    </div>
  );
}
