import React from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import type { HostKind } from '../host/context.ts';

const useStyles = makeStyles({
  banner: {
    padding: '6px 12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
});

const display: Record<HostKind, string> = { word: 'Word', excel: 'Excel' };

export function CrossHostBanner({ chatHost, currentHost }: { chatHost: HostKind; currentHost: HostKind }) {
  const styles = useStyles();
  return (
    <div className={styles.banner}>
      <Text size={200}>
        This conversation was started in {display[chatHost]}. You're in {display[currentHost]}. New messages will run against {display[currentHost]}'s APIs.
      </Text>
    </div>
  );
}
