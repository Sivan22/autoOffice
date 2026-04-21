import React from 'react';
import { makeStyles, tokens, Spinner, Text } from '@fluentui/react-components';
import { Checkmark12Regular } from '@fluentui/react-icons';

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

interface ToolActivityProps {
  activity: {
    toolName: string;
    status: 'calling' | 'done';
    result?: string;
  };
}

export function ToolActivity({ activity }: ToolActivityProps) {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {activity.status === 'calling' ? (
        <Spinner size="tiny" />
      ) : (
        <Checkmark12Regular />
      )}
      <Text size={200} italic>
        {activity.status === 'calling'
          ? `Calling ${activity.toolName}...`
          : `Called ${activity.toolName}`}
      </Text>
    </div>
  );
}
