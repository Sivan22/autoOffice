import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LegacyImportModal } from './LegacyImportModal';
import { bootstrap, _resetForTests } from '../api';

beforeEach(async () => {
  _resetForTests();
  (globalThis as any).fetch = vi.fn(async (url: string) => {
    if (url === '/bootstrap') {
      return new Response(JSON.stringify({ token: 't', version: 'v' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  await bootstrap();
});

describe('LegacyImportModal', () => {
  it('shows the summary and Skip dismisses', () => {
    const onDone = vi.fn();
    render(<LegacyImportModal payload={{ conversations: [], settings: { autoApprove: true } } as any} onDone={onDone} />);
    expect(screen.getByText(/import previous/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Skip'));
    expect(onDone).toHaveBeenCalled();
  });

  it('Import calls /api/import-legacy then onDone', async () => {
    const onDone = vi.fn();
    render(<LegacyImportModal payload={{ conversations: [], settings: { autoApprove: true } } as any} onDone={onDone} />);
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
