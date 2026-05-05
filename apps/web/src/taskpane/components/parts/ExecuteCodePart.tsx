import React from 'react';
import { makeStyles, tokens, Button, Badge, Text, Tooltip } from '@fluentui/react-components';
import { Dismiss20Regular, Play20Filled } from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: '8px',
    overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    maxWidth: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: tokens.colorNeutralBackground4,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  codeArea: {
    overflow: 'auto',
    maxHeight: '300px',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    color: tokens.colorNeutralForeground1,
    '& pre': {
      margin: 0,
      padding: '12px',
      display: 'block',
      minWidth: 'max-content',
      boxSizing: 'border-box',
    },
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  details: {
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  detailsError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  summary: {
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground2,
    userSelect: 'none',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground4Hover,
    },
  },
  summaryError: {
    color: tokens.colorPaletteRedForeground1,
    '&:hover': {
      backgroundColor: tokens.colorPaletteRedBackground2,
    },
  },
  resultBody: {
    padding: '8px 12px 12px 12px',
    fontSize: '12px',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '300px',
    overflow: 'auto',
    color: tokens.colorNeutralForeground1,
  },
  resultBodyError: {
    color: tokens.colorPaletteRedForeground1,
  },
});

type CodeStatus = 'streaming' | 'pending' | 'success' | 'error';

const STATUS_COLORS: Record<CodeStatus, 'informative' | 'success' | 'danger'> = {
  streaming: 'informative',
  pending: 'informative',
  success: 'success',
  error: 'danger',
};

const STATUS_LABELS: Record<CodeStatus, string> = {
  streaming: 'Generating…',
  pending: 'Awaiting Approval',
  success: 'Success',
  error: 'Error',
};

function statusFromState(state: string): CodeStatus {
  switch (state) {
    case 'input-streaming':
      return 'streaming';
    case 'output-error':
      return 'error';
    case 'output-available':
      return 'success';
    case 'input-available':
    default:
      return 'pending';
  }
}

type Props = {
  part: {
    state: string;
    toolCallId: string;
    input?: { code?: string };
    output?: unknown;
    errorText?: string;
  };
  onApprove: (toolCallId: string, code: string) => void;
  onReject: (toolCallId: string) => void;
  highlight: (code: string) => React.ReactNode;
};

export function ExecuteCodePart({ part, onApprove, onReject, highlight }: Props) {
  const styles = useStyles();
  const code = part.input?.code ?? '';
  const status = statusFromState(part.state);
  const isError = status === 'error';
  const showResult =
    (status === 'success' && part.output !== undefined) ||
    (status === 'error' && !!part.errorText);
  const resultText = isError
    ? part.errorText ?? ''
    : part.output !== undefined
    ? typeof part.output === 'string'
      ? part.output
      : JSON.stringify(part.output, null, 2)
    : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={200} weight="semibold">office.js</Text>
        <Badge appearance="filled" color={STATUS_COLORS[status]}>
          {STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className={styles.codeArea} dir="ltr">{highlight(code)}</div>

      {status === 'pending' && (
        <div className={styles.actions}>
          <Tooltip content="Approve & Run" relationship="label" withArrow>
            <Button
              appearance="primary"
              icon={<Play20Filled />}
              size="small"
              shape="circular"
              aria-label="Approve & Run"
              onClick={() => onApprove(part.toolCallId, code)}
            />
          </Tooltip>
          <Tooltip content="Reject" relationship="label" withArrow>
            <Button
              appearance="subtle"
              icon={<Dismiss20Regular />}
              size="small"
              shape="circular"
              aria-label="Reject"
              onClick={() => onReject(part.toolCallId)}
            />
          </Tooltip>
        </div>
      )}

      {showResult && (
        <details
          className={`${styles.details} ${isError ? styles.detailsError : ''}`}
          open={isError}
        >
          <summary className={`${styles.summary} ${isError ? styles.summaryError : ''}`}>
            {isError ? 'Error details' : 'Result'}
          </summary>
          <div
            className={`${styles.resultBody} ${isError ? styles.resultBodyError : ''}`}
            dir="ltr"
          >
            {resultText}
          </div>
        </details>
      )}
    </div>
  );
}
