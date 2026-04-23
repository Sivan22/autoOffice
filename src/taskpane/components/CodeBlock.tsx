import React from 'react';
import { makeStyles, tokens, Button, Badge, Text } from '@fluentui/react-components';
import {
  DismissCircle24Regular,
  Play24Regular,
} from '@fluentui/react-icons';

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
    padding: '12px',
    overflow: 'auto',
    maxHeight: '300px',
  },
  code: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '12px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
    color: tokens.colorNeutralForeground1,
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

type CodeStatus = 'pending' | 'rejected' | 'running' | 'success' | 'error';

const STATUS_LABELS: Record<CodeStatus, string> = {
  pending: 'Awaiting Approval',
  rejected: 'Rejected',
  running: 'Running...',
  success: 'Success',
  error: 'Error',
};

const STATUS_COLORS: Record<CodeStatus, 'informative' | 'success' | 'danger' | 'warning'> = {
  pending: 'informative',
  rejected: 'warning',
  running: 'informative',
  success: 'success',
  error: 'danger',
};

interface CodeBlockProps {
  code: string;
  status: CodeStatus;
  result?: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function CodeBlock({ code, status, result, onApprove, onReject }: CodeBlockProps) {
  const styles = useStyles();
  const isError = status === 'error';
  const showResult = (status === 'success' || status === 'error') && !!result;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={200} weight="semibold">office.js</Text>
        <Badge appearance="filled" color={STATUS_COLORS[status]}>
          {STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className={styles.codeArea}>
        <pre className={styles.code}>{code}</pre>
      </div>

      {status === 'pending' && onApprove && onReject && (
        <div className={styles.actions}>
          <Button appearance="primary" icon={<Play24Regular />} size="small" onClick={onApprove}>
            Approve & Run
          </Button>
          <Button appearance="subtle" icon={<DismissCircle24Regular />} size="small" onClick={onReject}>
            Reject
          </Button>
        </div>
      )}

      {showResult && (
        <details className={`${styles.details} ${isError ? styles.detailsError : ''}`} open={isError}>
          <summary className={`${styles.summary} ${isError ? styles.summaryError : ''}`}>
            {isError ? 'Error details' : 'Result'}
          </summary>
          <div className={`${styles.resultBody} ${isError ? styles.resultBodyError : ''}`}>
            {result}
          </div>
        </details>
      )}
    </div>
  );
}
