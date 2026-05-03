import React, { useState } from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Badge,
  Input,
  TabList,
  Tab,
  Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogTrigger,
} from '@fluentui/react-components';
import {
  ArrowLeft24Regular,
  Edit20Regular,
  Delete20Regular,
  Checkmark20Regular,
  Dismiss20Regular,
} from '@fluentui/react-icons';
import type { ConversationSummary } from '../store/history.ts';
import type { HostKind } from '../host/context.ts';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  filters: {
    padding: '8px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    flexShrink: 0,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  rowActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  rowTitle: {
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  rowActions: {
    display: 'flex',
    gap: '2px',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
});

export type HistoryFilter = 'current' | 'all' | HostKind;

export interface HistoryPanelProps {
  conversations: ConversationSummary[];
  currentHost: HostKind;
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function hostLabel(h: HostKind): string {
  return h.charAt(0).toUpperCase() + h.slice(1);
}

export function HistoryPanel({
  conversations,
  currentHost,
  activeId,
  onSelect,
  onRename,
  onDelete,
  onClose,
}: HistoryPanelProps) {
  const styles = useStyles();
  const [filter, setFilter] = useState<HistoryFilter>('current');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const filtered = conversations.filter(c => {
    if (filter === 'current') return c.host === currentHost;
    if (filter === 'all') return true;
    return c.host === filter;
  });

  const startRename = (c: ConversationSummary) => {
    setRenamingId(c.id);
    setRenameDraft(c.title);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      onRename(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          appearance="subtle"
          icon={<ArrowLeft24Regular />}
          onClick={onClose}
          aria-label="Close"
        />
        <Text weight="semibold">History</Text>
      </div>

      <div className={styles.filters}>
        <TabList
          selectedValue={filter}
          onTabSelect={(_, data) => setFilter(data.value as HistoryFilter)}
          size="small"
        >
          <Tab value="current">Current host</Tab>
          <Tab value="all">All</Tab>
          <Tab value="word">Word</Tab>
          <Tab value="excel">Excel</Tab>
          <Tab value="powerpoint">PowerPoint</Tab>
        </TabList>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Text>No conversations yet — start chatting to create one.</Text>
          </div>
        ) : filtered.map(c => {
          const isActive = c.id === activeId;
          const isRenaming = renamingId === c.id;
          return (
            <div
              key={c.id}
              className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
              onClick={(e) => {
                if (isRenaming) return;
                if ((e.target as HTMLElement).closest('[data-row-action]')) return;
                onSelect(c.id);
              }}
            >
              <div className={styles.rowMain}>
                {isRenaming ? (
                  <Input
                    value={renameDraft}
                    onChange={(_, d) => setRenameDraft(d.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onBlur={commitRename}
                    autoFocus
                  />
                ) : (
                  <div className={styles.rowTitle}>{c.title}</div>
                )}
                <div className={styles.rowMeta}>
                  <Badge appearance="outline" size="small">{hostLabel(c.host)}</Badge>
                  <span>{relativeTime(c.updatedAt)}</span>
                  <span>·</span>
                  <span>{c.messageCount} msg{c.messageCount === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className={styles.rowActions} data-row-action="">
                {isRenaming ? (
                  <>
                    <Button appearance="subtle" size="small" icon={<Checkmark20Regular />} onClick={commitRename} aria-label="Save name" />
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Dismiss20Regular />}
                      // preventDefault on mouseDown keeps focus on the input so its
                      // onBlur (commit) does not race ahead of this onClick (cancel).
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={cancelRename}
                      aria-label="Cancel rename"
                    />
                  </>
                ) : (
                  <>
                    <Button appearance="subtle" size="small" icon={<Edit20Regular />} onClick={() => startRename(c)} aria-label="Rename" />
                    <Dialog>
                      <DialogTrigger disableButtonEnhancement>
                        <Button appearance="subtle" size="small" icon={<Delete20Regular />} aria-label="Delete" />
                      </DialogTrigger>
                      <DialogSurface>
                        <DialogBody>
                          <DialogTitle>Delete this conversation?</DialogTitle>
                          <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                              <Button appearance="secondary">Cancel</Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                              <Button appearance="primary" onClick={() => onDelete(c.id)}>Delete</Button>
                            </DialogTrigger>
                          </DialogActions>
                        </DialogBody>
                      </DialogSurface>
                    </Dialog>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
