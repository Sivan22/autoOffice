import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBubble } from './ErrorBubble.tsx';
import { LanguageProvider } from '../i18n/index.ts';

describe('ErrorBubble', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders title and detail', () => {
    render(
      <LanguageProvider initialLocale="en">
        <ErrorBubble kind="api" title="Anthropic API error (401)" detail="invalid x-api-key" />
      </LanguageProvider>,
    );
    expect(screen.getByText('Anthropic API error (401)')).toBeInTheDocument();
    expect(screen.getByText('invalid x-api-key')).toBeInTheDocument();
  });

  it('hides technical details section when raw is missing', () => {
    render(
      <LanguageProvider initialLocale="en">
        <ErrorBubble kind="unknown" title="t" detail="d" />
      </LanguageProvider>,
    );
    expect(screen.queryByText(/technical details/i)).not.toBeInTheDocument();
  });

  it('shows technical details when raw is present', async () => {
    render(
      <LanguageProvider initialLocale="en">
        <ErrorBubble kind="api" title="t" detail="d" raw='{"x":1}' />
      </LanguageProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText(/technical details/i)).toBeInTheDocument();
    });
  });

  it('copies title + detail + raw to clipboard on Copy click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <LanguageProvider initialLocale="en">
        <ErrorBubble kind="api" title="T" detail="D" raw="R" />
      </LanguageProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('T\n\nD\n\nR');
  });
});
