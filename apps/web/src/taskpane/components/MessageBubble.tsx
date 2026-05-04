import React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { TextPart } from './parts/TextPart';
import { StepStartPart } from './parts/StepStartPart';
import { ExecuteCodePart } from './parts/ExecuteCodePart';
import { LookupSkillPart } from './parts/LookupSkillPart';
import { DynamicToolPart } from './parts/DynamicToolPart';
import { ApprovalRequestedPart } from './parts/ApprovalRequestedPart';

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
});

export type UIMessageLike = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<Record<string, unknown> & { type: string }>;
};

export type MessageBubbleProps = {
  message: UIMessageLike;
  onApproveCode: (toolCallId: string, code: string) => void;
  onRejectCode: (toolCallId: string) => void;
  onApprovalResponse: (id: string, approved: boolean) => void;
  highlightCode: (code: string) => React.ReactNode;
};

export function MessageBubble({
  message,
  onApproveCode,
  onRejectCode,
  onApprovalResponse,
  highlightCode,
}: MessageBubbleProps) {
  const styles = useStyles();
  const bubbleClass = message.role === 'user' ? styles.userBubble : styles.assistantBubble;

  return (
    <div className={styles.container}>
      <div className={bubbleClass}>
        {message.parts.map((part, idx) => {
          switch (part.type) {
            case 'text':
              return <TextPart key={idx} part={part as unknown as { text: string }} />;
            case 'step-start':
              return idx > 0 ? <StepStartPart key={idx} /> : null;
            case 'tool-execute_code':
              return (
                <ExecuteCodePart
                  key={idx}
                  part={part as any}
                  onApprove={onApproveCode}
                  onReject={onRejectCode}
                  highlight={highlightCode}
                />
              );
            case 'tool-lookup_skill':
              return <LookupSkillPart key={idx} part={part as any} />;
            case 'dynamic-tool':
              return <DynamicToolPart key={idx} part={part as any} />;
            default:
              if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                if ((part as any).state === 'approval-requested') {
                  return (
                    <ApprovalRequestedPart
                      key={idx}
                      part={part as any}
                      onResponse={onApprovalResponse}
                    />
                  );
                }
                return (
                  <DynamicToolPart
                    key={idx}
                    part={{ ...(part as any), toolName: part.type.slice(5) }}
                  />
                );
              }
              return null;
          }
        })}
      </div>
    </div>
  );
}
