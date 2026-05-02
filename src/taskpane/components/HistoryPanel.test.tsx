import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { HistoryPanel } from './HistoryPanel.tsx';
import type { ConversationSummary } from '../store/history.ts';

const summaries: ConversationSummary[] = [
  { id: 'w1', title: 'Word chat', host: 'word',  createdAt: 1000, updatedAt: 5000, messageCount: 4 },
  { id: 'e1', title: 'Excel chat', host: 'excel', createdAt: 2000, updatedAt: 4000, messageCount: 2 },
  { id: 'w2', title: 'Other Word', host: 'word',  createdAt: 3000, updatedAt: 3000, messageCount: 8 },
];

function renderPanel(overrides: Partial<ComponentProps<typeof HistoryPanel>> = {}) {
  const props = {
    conversations: summaries,
    currentHost: 'word' as const,
    activeId: null,
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<HistoryPanel {...props} />);
  return props;
}

describe('HistoryPanel', () => {
  afterEach(cleanup);

  it('defaults to "current host" filter and shows only that host\'s conversations', () => {
    renderPanel();
    expect(screen.getByText('Word chat')).toBeInTheDocument();
    expect(screen.getByText('Other Word')).toBeInTheDocument();
    expect(screen.queryByText('Excel chat')).not.toBeInTheDocument();
  });

  it('"All" filter shows every host', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /all/i }));
    expect(screen.getByText('Word chat')).toBeInTheDocument();
    expect(screen.getByText('Excel chat')).toBeInTheDocument();
  });

  it('"Excel" filter shows only excel conversations', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /excel/i }));
    expect(screen.getByText('Excel chat')).toBeInTheDocument();
    expect(screen.queryByText('Word chat')).not.toBeInTheDocument();
  });

  it('clicking a row fires onSelect with the row id', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByText('Word chat'));
    expect(props.onSelect).toHaveBeenCalledWith('w1');
  });

  it('clicking the close button fires onClose', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows an empty state when there are no conversations', () => {
    renderPanel({ conversations: [] });
    expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
  });
});
