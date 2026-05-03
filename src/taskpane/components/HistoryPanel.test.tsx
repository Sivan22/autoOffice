import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { HistoryPanel } from './HistoryPanel.tsx';
import type { ConversationSummary } from '../store/history.ts';
import { LanguageProvider } from '../i18n/index.ts';

const summaries: ConversationSummary[] = [
  { id: 'w1', title: 'Word chat', host: 'word',  createdAt: 1000, updatedAt: 5000, messageCount: 4 },
  { id: 'e1', title: 'Excel chat', host: 'excel', createdAt: 2000, updatedAt: 4000, messageCount: 2 },
  { id: 'w2', title: 'Other Word', host: 'word',  createdAt: 3000, updatedAt: 3000, messageCount: 8 },
  { id: 'p1', title: 'Slides chat', host: 'powerpoint', createdAt: 4000, updatedAt: 6000, messageCount: 3 },
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
  render(
    <LanguageProvider initialLocale="en">
      <HistoryPanel {...props} />
    </LanguageProvider>,
  );
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

  it('"PowerPoint" filter shows only powerpoint conversations', async () => {
    renderPanel();
    await userEvent.click(screen.getByRole('tab', { name: /powerpoint/i }));
    expect(screen.getByText('Slides chat')).toBeInTheDocument();
    expect(screen.queryByText('Word chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Excel chat')).not.toBeInTheDocument();
  });

  it('"current host" filter on PowerPoint shows only powerpoint conversations', () => {
    renderPanel({ currentHost: 'powerpoint' });
    expect(screen.getByText('Slides chat')).toBeInTheDocument();
    expect(screen.queryByText('Word chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Excel chat')).not.toBeInTheDocument();
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

  it('rename: typing then Enter calls onRename with trimmed title', async () => {
    const props = renderPanel();
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    await userEvent.click(renameButtons[0]); // first row in current-host filter is 'w1' / "Word chat"
    const input = screen.getByDisplayValue('Word chat');
    await userEvent.clear(input);
    await userEvent.type(input, '  New title  {Enter}');
    expect(props.onRename).toHaveBeenCalledWith('w1', 'New title');
  });

  it('rename: empty draft + Enter does not call onRename', async () => {
    const props = renderPanel();
    const renameButtons = screen.getAllByRole('button', { name: /rename/i });
    await userEvent.click(renameButtons[0]);
    const input = screen.getByDisplayValue('Word chat');
    await userEvent.clear(input);
    await userEvent.type(input, '   {Enter}'); // whitespace only
    expect(props.onRename).not.toHaveBeenCalled();
  });
});
