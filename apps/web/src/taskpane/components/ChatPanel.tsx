import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  makeStyles,
  tokens,
  Badge,
  Textarea,
  Button,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import {
  Send24Regular,
  Settings24Regular,
  History24Regular,
  Add24Regular,
} from '@fluentui/react-icons';
import type { ChatMessage } from '../agent/orchestrator.ts';
import type { HostContext } from '../host/context.ts';
import { CrossHostBanner } from './CrossHostBanner.tsx';
import type { HostKind } from '../host/context.ts';
import { useTranslation } from '../i18n/index.ts';
import { MessageBubble } from './MessageBubble.tsx';
import { CodeBlock } from './CodeBlock.tsx';

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
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    width: '24px',
    height: '24px',
    flexShrink: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: '16px',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '8px',
    color: tokens.colorNeutralForeground3,
    padding: '24px',
    textAlign: 'center',
  },
  approvalArea: {
    padding: '8px 12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '8px 12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  input: {
    flex: 1,
  },
  textarea: {
    width: '100%',
    minHeight: '32px',
    maxHeight: '200px',
    resize: 'none',
    overflowY: 'auto',
  },
});

interface ChatPanelProps {
  host: HostContext;
  messages: ChatMessage[];
  isLoading: boolean;
  pendingApproval: string | null;
  /** Host of the currently-loaded conversation; null = no active conversation. */
  activeChatHost: HostKind | null;
  onSend: (text: string) => void;
  onApprove: (approved: boolean) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onNewChat: () => void;
}

export function ChatPanel({
  host, messages, isLoading, pendingApproval, activeChatHost,
  onSend, onApprove, onOpenSettings, onOpenHistory, onNewChat,
}: ChatPanelProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const hostDisplay = t(
    host.kind === 'word' ? 'chat.hostWord' :
    host.kind === 'excel' ? 'chat.hostExcel' :
    'chat.hostPowerpoint',
  );
  const hostNoun = t(
    host.kind === 'word' ? 'chat.hostNounWord' :
    host.kind === 'excel' ? 'chat.hostNounExcel' :
    'chat.hostNounPowerpoint',
  );
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingApproval]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputText]);

  const handleSubmit = () => {
    if (!inputText.trim() || isLoading) return;
    onSend(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <img
            src={`${import.meta.env.BASE_URL}assets/icon-64.png`}
            alt=""
            className={styles.logo}
          />
          <Text className={styles.title}>AutoOffice</Text>
          <Badge
            appearance="outline"
            size="small"
            color={host.kind === 'excel' ? 'success' : host.kind === 'powerpoint' ? 'danger' : 'brand'}
          >
            {host.displayName}
          </Badge>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <Tooltip content={t('chat.historyTooltip')} relationship="label">
            <Button appearance="subtle" icon={<History24Regular />} onClick={onOpenHistory} disabled={isLoading} />
          </Tooltip>
          <Tooltip content={t('chat.newChatTooltip')} relationship="label">
            <Button appearance="subtle" icon={<Add24Regular />} onClick={onNewChat} disabled={isLoading} />
          </Tooltip>
          <Tooltip content={t('chat.settingsTooltip')} relationship="label">
            <Button appearance="subtle" icon={<Settings24Regular />} onClick={onOpenSettings} />
          </Tooltip>
        </div>
      </div>

      {activeChatHost && activeChatHost !== host.kind && (
        <CrossHostBanner chatHost={activeChatHost} currentHost={host.kind} />
      )}

      <div className={styles.messageList}>
        {messages.length === 0 && !pendingApproval ? (
          <div className={styles.empty}>
            <Text size={400} weight="semibold">{t('chat.welcomeTitle')}</Text>
            <Text size={200}>{t('chat.welcomeMessage', { host: hostDisplay, noun: hostNoun })}</Text>
            <Text size={200}>
              {host.kind === 'word'
                ? t('chat.exampleWord')
                : host.kind === 'excel'
                  ? t('chat.exampleExcel')
                  : t('chat.examplePowerpoint')}
            </Text>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {pendingApproval && (
        <div className={styles.approvalArea}>
          <CodeBlock
            code={pendingApproval}
            status="pending"
            onApprove={() => onApprove(true)}
            onReject={() => onApprove(false)}
          />
        </div>
      )}

      <div className={styles.inputArea}>
        <Textarea
          className={styles.input}
          textarea={{ ref: textareaRef, className: styles.textarea }}
          placeholder={t('chat.inputPlaceholder', { noun: hostNoun })}
          value={inputText}
          onChange={(_, data) => setInputText(data.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
        />
        <Button
          appearance="primary"
          icon={<Send24Regular />}
          aria-label={t('chat.sendButton')}
          onClick={handleSubmit}
          disabled={!inputText.trim() || isLoading}
        />
      </div>
    </div>
  );
}
