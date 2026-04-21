import React, { useEffect, useState } from 'react';
import { makeStyles, tokens, Button, Badge, Text } from '@fluentui/react-components';
import {
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Play24Regular,
  ArrowClockwise24Regular,
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
  error: {
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    fontSize: '12px',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});

interface CodeBlockProps {
  code: string;
  status: 'pending' | 'approved' | 'rejected' | 'running' | 'success' | 'error';
  error?: string;
  attempt?: number;
  onApprove: () => void;
  onReject: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Awaiting Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  running: 'Running...',
  success: 'Success',
  error: 'Error',
};

const STATUS_COLORS: Record<string, 'informative' | 'success' | 'danger' | 'warning' | 'important'> = {
  pending: 'informative',
  approved: 'informative',
  rejected: 'warning',
  running: 'informative',
  success: 'success',
  error: 'danger',
};

export function CodeBlock({ code, status, error, attempt, onApprove, onReject }: CodeBlockProps) {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={200} weight="semibold">
          office.js{attempt && attempt > 1 ? ` (attempt ${attempt})` : ''}
        </Text>
        <Badge appearance="filled" color={STATUS_COLORS[status] || 'informative'}>
          {STATUS_LABELS[status] || status}
        </Badge>
      </div>

      <div className={styles.codeArea}>
        <pre className={styles.code}>{code}</pre>
      </div>

      {status === 'pending' && (
        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={<Play24Regular />}
            size="small"
            onClick={onApprove}
          >
            Approve & Run
          </Button>
          <Button
            appearance="subtle"
            icon={<DismissCircle24Regular />}
            size="small"
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      )}

      {status === 'error' && error && (
        <div className={styles.error}>{error}</div>
      )}
    </div>
  );
}
