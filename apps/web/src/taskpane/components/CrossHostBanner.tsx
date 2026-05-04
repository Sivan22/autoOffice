import React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import type { HostKind } from '../host/context.ts';
import { useTranslation } from '../i18n/index.ts';

const useStyles = makeStyles({
  banner: {
    padding: '6px 12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
});

function hostKey(h: HostKind) {
  return h === 'word' ? 'history.filterWord' as const
       : h === 'excel' ? 'history.filterExcel' as const
       : 'history.filterPowerpoint' as const;
}

export function CrossHostBanner({ chatHost, currentHost }: { chatHost: HostKind; currentHost: HostKind }) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <div className={styles.banner}>
      <Text size={200}>
        {t('crossHost.message', {
          chatHost: t(hostKey(chatHost)),
          currentHost: t(hostKey(currentHost)),
        })}
      </Text>
    </div>
  );
}
