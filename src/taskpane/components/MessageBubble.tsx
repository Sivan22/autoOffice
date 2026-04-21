import React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import type { ChatMessage } from '../agent/orchestrator.ts';
import { CodeBlock } from './CodeBlock.tsx';
import { ToolActivity } from './ToolActivity.tsx';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 12px',
    maxWidth: '100%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    borderRadius: '12px 12px 4px 12px',
    padding: '8px 12px',
    maxWidth: '85%',
    wordBreak: 'break-word',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '12px 12px 12px 4px',
    padding: '8px 12px',
    maxWidth: '85%',
    wordBreak: 'break-word',
  },
  messageText: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.4',
    fontSize: '13px',
  },
});

interface MessageBubbleProps {
  message: ChatMessage;
  onApprove?: (approved: boolean) => void;
}

export function MessageBubble({ message, onApprove }: MessageBubbleProps) {
  const styles = useStyles();

  if (message.toolActivity) {
    return <ToolActivity activity={message.toolActivity} />;
  }

  if (message.codeBlock) {
    return (
      <div className={styles.container}>
        <CodeBlock
          code={message.codeBlock.code}
          status={message.codeBlock.status}
          error={message.codeBlock.error}
          attempt={message.codeBlock.attempt}
          onApprove={() => onApprove?.(true)}
          onReject={() => onApprove?.(false)}
        />
      </div>
    );
  }

  if (!message.content) return null;

  const bubbleClass = message.role === 'user' ? styles.userBubble : styles.assistantBubble;

  return (
    <div className={styles.container}>
      <div className={bubbleClass}>
        <Text className={styles.messageText}>{message.content}</Text>
      </div>
    </div>
  );
}
