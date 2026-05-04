import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from './context.tsx';
import { useTranslation, useDirection } from './hooks.ts';

function Probe() {
  const { t, locale, setLocale } = useTranslation();
  const dir = useDirection();
  return (
    <div>
      <span data-testid="text">{t('common.appName')}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="dir">{dir}</span>
      <button onClick={() => { void setLocale('he'); }} data-testid="switch">switch</button>
    </div>
  );
}

describe('LanguageProvider + hooks', () => {
  it('renders English by default and exposes ltr direction', async () => {
    render(
      <LanguageProvider initialLocale="en">
        <Probe />
      </LanguageProvider>,
    );
    // findBy* awaits async effects (initial dynamic import).
    await waitFor(() => {
      expect(screen.getByTestId('text').textContent).toBe('AutoOffice');
    });
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('dir').textContent).toBe('ltr');
  });

  it('switches to Hebrew, updates direction, and updates <html lang>/<dir>', async () => {
    render(
      <LanguageProvider initialLocale="en">
        <Probe />
      </LanguageProvider>,
    );
    // Wait for initial English load to settle so we have a clean baseline.
    await waitFor(() => {
      expect(screen.getByTestId('text').textContent).toBe('AutoOffice');
    });

    fireEvent.click(screen.getByTestId('switch'));

    await waitFor(() => {
      expect(screen.getByTestId('locale').textContent).toBe('he');
    });
    expect(screen.getByTestId('dir').textContent).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('he');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });
});
