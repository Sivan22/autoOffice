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
import type { HostContext } from '../host/context.ts';
import { useTranslation } from '../i18n/index.ts';
import { MessageBubble, type UIMessageLike } from './MessageBubble.tsx';

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
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '8px 12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderBottom: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    color: tokens.colorPaletteDarkOrangeForeground1,
    flexShrink: 0,
  },
  bannerError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderBottomColor: tokens.colorPaletteRedBorder1,
    color: tokens.colorPaletteRedForeground1,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
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

export interface ChatPanelProps {
  host: HostContext;
  messages: UIMessageLike[];
  status: 'submitted' | 'streaming' | 'ready' | 'error' | string;
  /** Last error from the chat stream, if any. Surfaced as an inline banner. */
  chatError?: string | null;
  /** True when no provider is configured/selected; disables send and shows banner. */
  noProvider?: boolean;
  onSubmit: (text: string) => void;
  onApproveCode: (toolCallId: string, code: string) => Promise<void> | void;
  onRejectCode: (toolCallId: string) => void;
  onApprovalResponse: (id: string, approved: boolean) => void;
  highlightCode: (code: string) => React.ReactNode;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
  onNewChat?: () => void;
}

export function ChatPanel({
  host,
  messages,
  status,
  chatError,
  noProvider,
  onSubmit,
  onApproveCode,
  onRejectCode,
  onApprovalResponse,
  highlightCode,
  onOpenSettings,
  onOpenHistory,
  onNewChat,
}: ChatPanelProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const isLoading = status === 'submitted' || status === 'streaming';
  const hostDisplay = t(
    host.kind === 'word'
      ? 'chat.hostWord'
      : host.kind === 'excel'
        ? 'chat.hostExcel'
        : 'chat.hostPowerpoint',
  );
  const hostNoun = t(
    host.kind === 'word'
      ? 'chat.hostNounWord'
      : host.kind === 'excel'
        ? 'chat.hostNounExcel'
        : 'chat.hostNounPowerpoint',
  );
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [inputText]);

  const handleSubmit = () => {
    if (!inputText.trim() || isLoading || noProvider) return;
    onSubmit(inputText);
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
      <div className={styles.header} dir="ltr">
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
          {onOpenHistory && (
            <Tooltip content={t('chat.historyTooltip')} relationship="label">
              <Button
                appearance="subtle"
                icon={<History24Regular />}
                onClick={onOpenHistory}
                disabled={isLoading}
              />
            </Tooltip>
          )}
          {onNewChat && (
            <Tooltip content={t('chat.newChatTooltip')} relationship="label">
              <Button
                appearance="subtle"
                icon={<Add24Regular />}
                onClick={onNewChat}
                disabled={isLoading}
              />
            </Tooltip>
          )}
          {onOpenSettings && (
            <Tooltip content={t('chat.settingsTooltip')} relationship="label">
              <Button appearance="subtle" icon={<Settings24Regular />} onClick={onOpenSettings} />
            </Tooltip>
          )}
        </div>
      </div>

      {noProvider && (
        <div className={styles.banner} role="status">
          <Text className={styles.bannerText} size={200}>
            No AI provider is configured. Add one in Settings to start chatting.
          </Text>
          {onOpenSettings && (
            <Button appearance="primary" size="small" onClick={onOpenSettings}>
              Open Settings
            </Button>
          )}
        </div>
      )}

      {chatError && !noProvider && (
        <div
          className={`${styles.banner} ${styles.bannerError}`}
          role="alert"
          aria-label="Chat error"
        >
          <Text className={styles.bannerText} size={200}>
            {chatError}
          </Text>
          {onOpenSettings && (
            <Button appearance="subtle" size="small" onClick={onOpenSettings}>
              Settings
            </Button>
          )}
        </div>
      )}

      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <Text size={400} weight="semibold">
              {t('chat.welcomeTitle')}
            </Text>
            <Text size={200}>
              {t('chat.welcomeMessage', { host: hostDisplay, noun: hostNoun })}
            </Text>
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
            <MessageBubble
              key={msg.id ?? i}
              message={msg}
              onApproveCode={onApproveCode}
              onRejectCode={onRejectCode}
              onApprovalResponse={onApprovalResponse}
              highlightCode={highlightCode}
              streaming={
                isLoading && i === messages.length - 1 && msg.role === 'assistant'
              }
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

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
          disabled={!inputText.trim() || isLoading || !!noProvider}
        />
      </div>
    </div>
  );
}
