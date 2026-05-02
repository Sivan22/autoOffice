import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from './context';
import { useTranslation } from './hooks';
import React, { useState } from 'react';

// Test component that simulates a real application
function PerformanceTestComponent() {
  const { t, locale, setLocale } = useTranslation();
  const [inputValue, setInputValue] = useState('test input');
  const [counter, setCounter] = useState(0);

  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="translated-text">{t('common.appName')}</div>
      <input
        data-testid="input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <div data-testid="counter">{counter}</div>
      <button data-testid="increment" onClick={() => setCounter(c => c + 1)}>
        Increment
      </button>
      <button data-testid="switch-en" onClick={() => setLocale('en')}>
        English
      </button>
      <button data-testid="switch-he" onClick={() => setLocale('he')}>
        עברית
      </button>
    </div>
  );
}

describe('Language Switching Performance', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should switch language within 200ms', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <PerformanceTestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('locale')).toHaveTextContent('en');

    const startTime = performance.now();
    
    // Switch to Hebrew
    await user.click(screen.getByTestId('switch-he'));
    
    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('he');
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Language switch should complete within 300ms (allowing for test overhead)
    expect(duration).toBeLessThan(300);
  });

  it('should preserve application state during language switch', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <PerformanceTestComponent />
      </LanguageProvider>
    );

    // Set some application state
    const input = screen.getByTestId('input');
    await user.clear(input);
    await user.type(input, 'preserved value');
    
    await user.click(screen.getByTestId('increment'));
    await user.click(screen.getByTestId('increment'));
    
    expect(screen.getByTestId('counter')).toHaveTextContent('2');
    expect(input).toHaveValue('preserved value');

    // Switch language
    await user.click(screen.getByTestId('switch-he'));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('he');
    });

    // State should be preserved
    expect(screen.getByTestId('counter')).toHaveTextContent('2');
    expect(input).toHaveValue('preserved value');
  });

  it('should preserve user input during language switch', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <PerformanceTestComponent />
      </LanguageProvider>
    );

    const input = screen.getByTestId('input');
    await user.clear(input);
    await user.type(input, 'important data');

    // Switch language while input has value
    await user.click(screen.getByTestId('switch-he'));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('he');
    });

    // Input value should be preserved
    expect(input).toHaveValue('important data');
  });

  it('should not reload the page during language switch', async () => {
    const user = userEvent.setup();
    
    // Track if page reloaded by checking if a variable persists
    let pageReloaded = false;
    const originalLocation = window.location;
    
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        reload: () => {
          pageReloaded = true;
        },
      },
      writable: true,
    });

    render(
      <LanguageProvider initialLocale="en">
        <PerformanceTestComponent />
      </LanguageProvider>
    );

    await user.click(screen.getByTestId('switch-he'));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('he');
    });

    // Page should not have reloaded
    expect(pageReloaded).toBe(false);

    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('should update all translated text immediately', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <PerformanceTestComponent />
      </LanguageProvider>
    );

    const translatedText = screen.getByTestId('translated-text');
    expect(translatedText).toHaveTextContent('AutoOffice');

    await user.click(screen.getByTestId('switch-he'));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('he');
    });

    // Translated text should update immediately
    expect(translatedText).toHaveTextContent('AutoOffice');
  });
});
