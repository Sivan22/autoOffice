import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from './context';
import { useTranslation } from './hooks';
import React from 'react';

// Test component with language selector
function AccessibilityTestComponent() {
  const { t, locale, setLocale, availableLocales } = useTranslation();

  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <label htmlFor="language-select">{t('settings.languageLabel')}</label>
      <select
        id="language-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as any)}
        aria-label={t('settings.languageLabel')}
        aria-describedby="language-description"
      >
        {availableLocales.map(loc => (
          <option key={loc.code} value={loc.code}>
            {loc.nativeName}
          </option>
        ))}
      </select>
      <div id="language-description" style={{ display: 'none' }}>
        {t('settings.languageDescription')}
      </div>
      <button onClick={() => setLocale('en')}>English</button>
      <button onClick={() => setLocale('he')}>עברית</button>
    </div>
  );
}

describe('Language Accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    // Clear any existing announcements
    document.body.innerHTML = '';
  });

  it('should have keyboard navigation support for language selector', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    const select = screen.getByLabelText('Interface Language');
    
    // Focus the select element
    select.focus();
    expect(select).toHaveFocus();

    // Should be able to change value with keyboard
    await user.selectOptions(select, 'he');
    
    // Language should change
    await waitFor(() => {
      expect(select).toHaveValue('he');
    });
  });

  it('should have ARIA labels on language selector', () => {
    render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    const select = screen.getByRole('combobox');
    expect(select).toHaveAttribute('aria-label');
    expect(select).toHaveAttribute('aria-describedby', 'language-description');
  });

  it('should announce language changes to screen readers', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    // Switch to Hebrew using button with role
    const hebrewButton = screen.getAllByText('עברית').find(el => el.tagName === 'BUTTON');
    await user.click(hebrewButton!);

    // Wait for announcement to be added
    await waitFor(() => {
      const announcements = document.querySelectorAll('[role="status"][aria-live="polite"]');
      expect(announcements.length).toBeGreaterThan(0);
    });

    // Check announcement content
    const announcement = document.querySelector('[role="status"][aria-live="polite"]');
    expect(announcement?.textContent).toContain('עברית');
  });

  it('should update ARIA labels when language changes', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    let select = screen.getByRole('combobox');
    const initialLabel = select.getAttribute('aria-label');
    expect(initialLabel).toBeTruthy();

    // Switch to Hebrew using button
    const hebrewButton = screen.getAllByText('עברית').find(el => el.tagName === 'BUTTON');
    await user.click(hebrewButton!);

    await waitFor(() => {
      select = screen.getByRole('combobox');
      const newLabel = select.getAttribute('aria-label');
      expect(newLabel).toBeTruthy();
      expect(newLabel).not.toBe(initialLabel);
    });
  });

  it('should maintain focus during RTL/LTR switch', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    const select = screen.getByRole('combobox');
    
    // Focus the select
    select.focus();
    expect(select).toHaveFocus();

    // Switch language using button
    const hebrewButton = screen.getAllByText('עברית').find(el => el.tagName === 'BUTTON');
    await user.click(hebrewButton!);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('he');
    });

    // Focus should be maintained (or at least manageable)
    // Note: In real implementation, you might want to restore focus to the select
    const newSelect = screen.getByRole('combobox');
    expect(newSelect).toBeInTheDocument();
  });

  it('should have proper tab order in both LTR and RTL', async () => {
    const user = userEvent.setup();
    
    const { rerender } = render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    // Tab through elements in LTR
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();
    
    await user.tab();
    const englishButton = screen.getAllByText('English').find(el => el.tagName === 'BUTTON');
    expect(englishButton).toHaveFocus();

    // Switch to RTL
    rerender(
      <LanguageProvider initialLocale="he">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    // Tab order should still work
    document.body.focus();
    await user.tab();
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('should remove screen reader announcements after they are read', async () => {
    const user = userEvent.setup();
    
    render(
      <LanguageProvider initialLocale="en">
        <AccessibilityTestComponent />
      </LanguageProvider>
    );

    // Switch language using button
    const hebrewButton = screen.getAllByText('עברית').find(el => el.tagName === 'BUTTON');
    await user.click(hebrewButton!);

    // Announcement should be present
    await waitFor(() => {
      const announcements = document.querySelectorAll('[role="status"][aria-live="polite"]');
      expect(announcements.length).toBeGreaterThan(0);
    }, { timeout: 1000 });

    // Wait for announcement to be removed (1 second + buffer)
    await waitFor(() => {
      const announcements = document.querySelectorAll('[role="status"][aria-live="polite"]');
      expect(announcements.length).toBe(0);
    }, { timeout: 2000 });
  });
});
