import React from 'react';
import { makeStyles, tokens, Badge, Text, Spinner } from '@fluentui/react-components';

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
    '&:last-child': { borderBottom: 'none' },
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
    '&:hover': { backgroundColor: tokens.colorNeutralBackground4Hover },
  },
  summaryError: {
    color: tokens.colorPaletteRedForeground1,
    '&:hover': { backgroundColor: tokens.colorPaletteRedBackground2 },
  },
  body: {
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
  bodyError: {
    color: tokens.colorPaletteRedForeground1,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
});

type BadgeColor = 'warning' | 'success' | 'danger' | 'subtle' | 'informative';

function stateBadge(state: string | undefined): { label: string; color: BadgeColor; spinning?: boolean } {
  switch (state) {
    case 'input-streaming': return { label: 'Calling…', color: 'informative', spinning: true };
    case 'input-available':  return { label: 'Calling…', color: 'informative', spinning: true };
    case 'output-available': return { label: 'Done',     color: 'success' };
    case 'output-error':     return { label: 'Error',    color: 'danger' };
    default:                 return { label: state ?? 'Running…', color: 'informative', spinning: true };
  }
}

export function DynamicToolPart({
  part,
}: {
  part: {
    toolName?: string;
    input?: unknown;
    output?: unknown;
    state?: string;
    errorText?: string;
  };
}) {
  const styles = useStyles();
  const { label, color, spinning } = stateBadge(part.state);

  const toolName = (part.toolName ?? 'tool').replace(/^mcp_[^_]+_/, '');
  const hasInput = part.input != null && Object.keys(part.input as object).length > 0;
  const hasOutput = part.state === 'output-available' && part.output !== undefined;
  const hasError = part.state === 'output-error' && !!part.errorText;

  const outputText = part.output !== undefined
    ? typeof part.output === 'string'
      ? part.output
      : JSON.stringify(part.output, null, 2)
    : '';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {spinning && <Spinner size="extra-tiny" />}
          <Text size={200} weight="semibold">{toolName}</Text>
        </div>
        <Badge appearance="filled" color={color}>{label}</Badge>
      </div>

      {hasInput && (
        <details className={styles.details}>
          <summary className={styles.summary}>Parameters</summary>
          <div className={styles.body}>
            {JSON.stringify(part.input, null, 2)}
          </div>
        </details>
      )}

      {hasOutput && (
        <details className={styles.details}>
          <summary className={styles.summary}>Result</summary>
          <div className={styles.body}>{outputText}</div>
        </details>
      )}

      {hasError && (
        <details className={`${styles.details} ${styles.detailsError}`} open>
          <summary className={`${styles.summary} ${styles.summaryError}`}>Error</summary>
          <div className={`${styles.body} ${styles.bodyError}`}>{part.errorText}</div>
        </details>
      )}
    </div>
  );
}
