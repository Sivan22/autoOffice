import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { HistoryPanel } from './HistoryPanel';
import * as api from '../api';
import type { Conversation } from '@autooffice/shared';

const wrap = (ui: React.ReactElement) =>
  render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

const sample: Conversation[] = [
  {
    id: 'c1',
    title: 'Word doc edits',
    host: 'word',
    providerId: null,
    modelId: null,
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000,
  },
  {
    id: 'c2',
    title: 'Excel chart',
    host: 'excel',
    providerId: null,
    modelId: null,
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000,
  },
  {
    id: 'c3',
    title: 'Word slide deck',
    host: 'word',
    providerId: null,
    modelId: null,
    createdAt: Date.now() - 3000,
    updatedAt: Date.now() - 3000,
  },
];

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders conversations filtered to currentHost by default', async () => {
    const onSelect = vi.fn();
    wrap(
      <HistoryPanel
        currentHost="word"
        activeConversationId={null}
        onSelectConversation={onSelect}
        onClose={() => {}}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Word doc edits')).toBeInTheDocument();
    });
    expect(screen.getByText('Word slide deck')).toBeInTheDocument();
    expect(screen.queryByText('Excel chart')).not.toBeInTheDocument();
  });

  it('shows all hosts when "show all" toggle is on', async () => {
    wrap(
      <HistoryPanel
        currentHost="word"
        activeConversationId={null}
        onSelectConversation={() => {}}
        onClose={() => {}}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Word doc edits')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Show all hosts'));
    expect(screen.getByText('Excel chart')).toBeInTheDocument();
  });

  it('fires onSelectConversation when a row is clicked', async () => {
    const onSelect = vi.fn();
    wrap(
      <HistoryPanel
        currentHost="word"
        activeConversationId={null}
        onSelectConversation={onSelect}
        onClose={() => {}}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Word doc edits')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Word doc edits'));
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('does not select when an action button inside the row is clicked', async () => {
    const onSelect = vi.fn();
    // apiSend will be called by rename — stub it to avoid the network.
    const apiSendSpy = vi.spyOn(api, 'apiSend').mockResolvedValue({} as any);
    wrap(
      <HistoryPanel
        currentHost="word"
        activeConversationId={null}
        onSelectConversation={onSelect}
        onClose={() => {}}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Word doc edits')).toBeInTheDocument();
    });
    const renameBtns = screen.getAllByLabelText('Rename conversation');
    fireEvent.click(renameBtns[0]);
    expect(onSelect).not.toHaveBeenCalled();
    apiSendSpy.mockRestore();
  });

  it('renders empty state when no conversations match', async () => {
    wrap(
      <HistoryPanel
        currentHost="powerpoint"
        activeConversationId={null}
        onSelectConversation={() => {}}
        onClose={() => {}}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/No conversations yet/)).toBeInTheDocument();
    });
  });

  it('deletes a conversation immediately when the delete button is clicked', async () => {
    const apiSendSpy = vi.spyOn(api, 'apiSend').mockResolvedValue(undefined as any);
    // Make sure native confirm is *not* what gates the flow.
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    wrap(
      <HistoryPanel
        currentHost="word"
        activeConversationId={null}
        onSelectConversation={() => {}}
        onClose={() => {}}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Word doc edits')).toBeInTheDocument();
    });
    const deleteBtns = screen.getAllByLabelText('Delete conversation');
    fireEvent.click(deleteBtns[0]);
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(apiSendSpy).toHaveBeenCalledWith('/api/conversations/c1', null, 'DELETE');
    });
    apiSendSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    wrap(
      <HistoryPanel
        currentHost="word"
        activeConversationId={null}
        onSelectConversation={() => {}}
        onClose={onClose}
        loadConversations={async () => sample}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Word doc edits')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('Close history'));
    expect(onClose).toHaveBeenCalled();
  });
});
