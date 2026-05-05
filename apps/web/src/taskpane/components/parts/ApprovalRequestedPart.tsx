import React from 'react';
import { makeStyles, tokens, Button, Badge, Text, Tooltip } from '@fluentui/react-components';
import { CheckmarkCircle24Regular, DismissCircle24Regular } from '@fluentui/react-icons';

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
  details: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
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
    listStyle: 'none',
    '&::-webkit-details-marker': { display: 'none' },
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
  detailsBody: {
    padding: '8px 12px 12px 12px',
    fontSize: '12px',
    fontFamily: 'Consolas, "Courier New", monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '300px',
    overflow: 'auto',
    color: tokens.colorNeutralForeground1,
    direction: 'ltr',
    textAlign: 'left',
  },
  detailsBodyError: {
    color: tokens.colorPaletteRedForeground1,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '8px 12px',
  },
  approveBtn: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    borderTopColor: tokens.colorPaletteGreenBorderActive,
    borderRightColor: tokens.colorPaletteGreenBorderActive,
    borderBottomColor: tokens.colorPaletteGreenBorderActive,
    borderLeftColor: tokens.colorPaletteGreenBorderActive,
    color: tokens.colorNeutralForegroundOnBrand,
    '&:hover': {
      backgroundColor: tokens.colorPaletteGreenForeground1,
      borderTopColor: tokens.colorPaletteGreenForeground1,
      borderRightColor: tokens.colorPaletteGreenForeground1,
      borderBottomColor: tokens.colorPaletteGreenForeground1,
      borderLeftColor: tokens.colorPaletteGreenForeground1,
      color: tokens.colorNeutralForegroundOnBrand,
    },
    '&:hover:active': {
      backgroundColor: tokens.colorPaletteGreenForeground3,
      borderTopColor: tokens.colorPaletteGreenForeground3,
      borderRightColor: tokens.colorPaletteGreenForeground3,
      borderBottomColor: tokens.colorPaletteGreenForeground3,
      borderLeftColor: tokens.colorPaletteGreenForeground3,
      color: tokens.colorNeutralForegroundOnBrand,
    },
  },
});

type BadgeColor = 'warning' | 'success' | 'danger' | 'subtle' | 'informative';

const STATE_BADGE: Record<string, { label: string; color: BadgeColor }> = {
  'approval-requested': { label: 'Pending', color: 'warning' },
  'output-available':   { label: 'Done',    color: 'success' },
  'output-error':       { label: 'Error',   color: 'danger'  },
  'output-denied':      { label: 'Denied',  color: 'subtle'  },
};

type Props = {
  part: {
    type: string;
    toolCallId?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    approval?: { id: string };
    state?: string;
  };
  onResponse: (id: string, approved: boolean) => void;
};

export function ApprovalRequestedPart({ part, onResponse }: Props) {
  const styles = useStyles();

  const state = part.state ?? 'approval-requested';
  const badge = STATE_BADGE[state] ?? { label: state, color: 'informative' as BadgeColor };
  const toolName = part.type.replace(/^tool-/, '').replace(/^mcp_[^_]+_/, '');

  const hasParams = part.input != null && Object.keys(part.input as object).length > 0;
  const isError = state === 'output-error';
  const showResult = state === 'output-available' && part.output !== undefined;
  const showError = isError && !!part.errorText;
  const resultText =
    part.output !== undefined
      ? typeof part.output === 'string'
        ? part.output
        : JSON.stringify(part.output, null, 2)
      : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={200} weight="semibold">{toolName}</Text>
        <Badge appearance="filled" color={badge.color}>{badge.label}</Badge>
      </div>

      {hasParams && (
        <details className={styles.details}>
          <summary className={styles.summary}>Parameters</summary>
          <div className={styles.detailsBody}>
            {JSON.stringify(part.input, null, 2)}
          </div>
        </details>
      )}

      {showResult && (
        <details className={styles.details}>
          <summary className={styles.summary}>Result</summary>
          <div className={styles.detailsBody}>{resultText}</div>
        </details>
      )}

      {showError && (
        <details className={`${styles.details} ${styles.detailsError}`} open>
          <summary className={`${styles.summary} ${styles.summaryError}`}>Error</summary>
          <div className={`${styles.detailsBody} ${styles.detailsBodyError}`}>{part.errorText}</div>
        </details>
      )}

      {state === 'approval-requested' && part.approval && (
        <div className={styles.actions}>
          <Tooltip content="Approve" relationship="label" withArrow>
            <Button
              className={styles.approveBtn}
              icon={<CheckmarkCircle24Regular />}
              size="small"
              aria-label="Approve"
              onClick={() => onResponse(part.approval!.id, true)}
            />
          </Tooltip>
          <Tooltip content="Deny" relationship="label" withArrow>
            <Button
              appearance="subtle"
              icon={<DismissCircle24Regular />}
              size="small"
              aria-label="Deny"
              onClick={() => onResponse(part.approval!.id, false)}
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
}
