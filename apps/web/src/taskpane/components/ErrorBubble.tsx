import React from 'react';
import { makeStyles, tokens, Button, Text } from '@fluentui/react-components';
import { Copy24Regular } from '@fluentui/react-icons';
import type { ErrorKind } from '../agent/errors.ts';
import { useTranslation } from '../i18n/index.ts';

const useStyles = makeStyles({
  container: {
    alignSelf: 'stretch',
    margin: '4px 12px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  title: {
    fontWeight: 600,
    fontSize: '13px',
  },
  detail: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  details: {
    marginTop: '4px',
  },
  summary: {
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    userSelect: 'none',
  },
  raw: {
    marginTop: '6px',
    padding: '8px',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: '11px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '240px',
    overflow: 'auto',
    borderRadius: '4px',
  },
});

export interface ErrorBubbleProps {
  kind: ErrorKind;
  title: string;
  detail: string;
  raw?: string;
}

export function ErrorBubble({ title, detail, raw }: ErrorBubbleProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const handleCopy = () => {
    const payload = [title, detail, raw ?? ''].filter(Boolean).join('\n\n');
    void navigator.clipboard?.writeText(payload);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text className={styles.title}>{title}</Text>
        <Button
          appearance="subtle"
          icon={<Copy24Regular />}
          size="small"
          onClick={handleCopy}
          aria-label={t('errorBubble.copyButton')}
        >
          {t('errorBubble.copyButton')}
        </Button>
      </div>
      <div className={styles.detail}>{detail}</div>
      {raw && (
        <details className={styles.details}>
          <summary className={styles.summary}>{t('errorBubble.technicalDetails')}</summary>
          <pre className={styles.raw}>{raw}</pre>
        </details>
      )}
    </div>
  );
}
