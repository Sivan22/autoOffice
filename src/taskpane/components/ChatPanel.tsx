import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  makeStyles,
  tokens,
  Textarea,
  Button,
  Text,
  Tooltip,
} from '@fluentui/react-components';
import {
  Send24Regular,
  Settings24Regular,
} from '@fluentui/react-icons';
import type { ChatMessage } from '../agent/orchestrator.ts';
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
  messages: ChatMessage[];
  isLoading: boolean;
  pendingApproval: string | null;
  onSend: (text: string) => void;
  onApprove: (approved: boolean) => void;
  onOpenSettings: () => void;
}

export function ChatPanel({ messages, isLoading, pendingApproval, onSend, onApprove, onOpenSettings }: ChatPanelProps) {
  const styles = useStyles();
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
        <Text className={styles.title}>AutoOffice</Text>
        <Tooltip content="Settings" relationship="label">
          <Button
            appearance="subtle"
            icon={<Settings24Regular />}
            onClick={onOpenSettings}
          />
        </Tooltip>
      </div>

      <div className={styles.messageList}>
        {messages.length === 0 && !pendingApproval ? (
          <div className={styles.empty}>
            <Text size={400} weight="semibold">Welcome to AutoOffice</Text>
            <Text size={200}>
              Ask me to do anything with your Word document. I'll write and run office.js code to make it happen.
            </Text>
            <Text size={200}>
              Try: "Make all headings blue" or "Insert a 3-column table"
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
          placeholder="Ask me to modify the document..."
          value={inputText}
          onChange={(_, data) => setInputText(data.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
        />
        <Button
          appearance="primary"
          icon={<Send24Regular />}
          onClick={handleSubmit}
          disabled={!inputText.trim() || isLoading}
        />
      </div>
    </div>
  );
}
