import React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import { Checkmark12Regular } from '@fluentui/react-icons';
import { useTranslation } from '../i18n';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
});

export function ToolActivity({ toolName }: { toolName: string }) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <Checkmark12Regular />
      <Text size={200} italic>{t('code.toolActivity', { toolName })}</Text>
    </div>
  );
}
