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
import { useTranslation, useFormatters } from '../i18n/index.ts';

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

function formatRelativeAgo(
  ts: number,
  fmt: (value: number, unit: Intl.RelativeTimeFormatUnit) => string,
): string {
  const diffMs = ts - Date.now();
  const m = Math.round(diffMs / 60_000);
  if (Math.abs(m) < 1) return fmt(0, 'second');
  if (Math.abs(m) < 60) return fmt(m, 'minute');
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return fmt(h, 'hour');
  const d = Math.round(h / 24);
  return fmt(d, 'day');
}

function hostBadgeKey(h: HostKind) {
  return h === 'word' ? 'history.filterWord' as const
       : h === 'excel' ? 'history.filterExcel' as const
       : 'history.filterPowerpoint' as const;
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
  const { t } = useTranslation();
  const { formatRelativeTime, formatPlural } = useFormatters();
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
          aria-label={t('history.closeAria')}
        />
        <Text weight="semibold">{t('history.title')}</Text>
      </div>

      <div className={styles.filters}>
        <TabList
          selectedValue={filter}
          onTabSelect={(_, data) => setFilter(data.value as HistoryFilter)}
          size="small"
        >
          <Tab value="current">{t('history.filterCurrent')}</Tab>
          <Tab value="all">{t('history.filterAll')}</Tab>
          <Tab value="word">{t('history.filterWord')}</Tab>
          <Tab value="excel">{t('history.filterExcel')}</Tab>
          <Tab value="powerpoint">{t('history.filterPowerpoint')}</Tab>
        </TabList>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Text>{t('history.empty')}</Text>
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
                  <Badge appearance="outline" size="small">{t(hostBadgeKey(c.host))}</Badge>
                  <span>{formatRelativeAgo(c.updatedAt, formatRelativeTime)}</span>
                  <span>·</span>
                  <span>{formatPlural(c.messageCount, {
                    one: t('history.messageCount_one'),
                    other: t('history.messageCount_other'),
                  })}</span>
                </div>
              </div>
              <div className={styles.rowActions} data-row-action="">
                {isRenaming ? (
                  <>
                    <Button appearance="subtle" size="small" icon={<Checkmark20Regular />} onClick={commitRename} aria-label={t('history.saveNameAria')} />
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Dismiss20Regular />}
                      // preventDefault on mouseDown keeps focus on the input so its
                      // onBlur (commit) does not race ahead of this onClick (cancel).
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={cancelRename}
                      aria-label={t('history.cancelRenameAria')}
                    />
                  </>
                ) : (
                  <>
                    <Button appearance="subtle" size="small" icon={<Edit20Regular />} onClick={() => startRename(c)} aria-label={t('history.renameAria')} />
                    <Dialog>
                      <DialogTrigger disableButtonEnhancement>
                        <Button appearance="subtle" size="small" icon={<Delete20Regular />} aria-label={t('history.deleteAria')} />
                      </DialogTrigger>
                      <DialogSurface>
                        <DialogBody>
                          <DialogTitle>{t('history.deleteConfirmTitle')}</DialogTitle>
                          <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                              <Button appearance="secondary">{t('history.deleteConfirmCancel')}</Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                              <Button appearance="primary" onClick={() => onDelete(c.id)}>{t('history.deleteConfirmConfirm')}</Button>
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
