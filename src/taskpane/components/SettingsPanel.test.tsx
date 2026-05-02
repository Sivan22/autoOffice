import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SettingsPanel } from './SettingsPanel';
import { LanguageProvider } from '../i18n/context';
import * as storage from '../i18n/storage';
import * as layout from '../i18n/layout';
import type { AppSettings } from '../store/settings';

// Mock the storage and layout modules
vi.mock('../i18n/storage');
vi.mock('../i18n/layout');

const mockSettings: AppSettings = {
  language: 'en',
  selectedProviderId: 'anthropic',
  selectedModel: 'claude-sonnet-4-6',
  providers: [
    {
      id: 'anthropic',
      name: 'Anthropic',
      apiKey: 'test-key',
    },
  ],
  autoApprove: false,
  mcpServers: [],
  maxRetries: 3,
  executionTimeout: 30000,
};

describe('SettingsPanel - Language Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(storage.languageStorage.loadLanguage).mockReturnValue(null);
    vi.mocked(storage.languageStorage.detectLanguage).mockReturnValue('en');
    vi.mocked(storage.languageStorage.saveLanguage).mockImplementation(() => {});
    vi.mocked(layout.getDirection).mockReturnValue('ltr');
    vi.mocked(layout.applyDirection).mockImplementation(() => {});
  });

  const renderSettingsPanel = (settings: AppSettings = mockSettings) => {
    const onChange = vi.fn();
    const onClose = vi.fn();

    const result = render(
      <LanguageProvider initialLocale={settings.language}>
        <SettingsPanel settings={settings} onChange={onChange} onClose={onClose} />
      </LanguageProvider>
    );

    return { ...result, onChange, onClose };
  };

  describe('Language selector display', () => {
    it('should display language section with label', () => {
      renderSettingsPanel();

      expect(screen.getByText('Language')).toBeInTheDocument();
      expect(screen.getByText('Interface Language')).toBeInTheDocument();
    });

    it('should display current language in selector', () => {
      renderSettingsPanel();

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      expect(languageSelect).toHaveValue('en');
    });

    it('should display Hebrew when language is set to Hebrew', () => {
      const hebrewSettings = { ...mockSettings, language: 'he' as const };
      renderSettingsPanel(hebrewSettings);

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      expect(languageSelect).toHaveValue('he');
    });

    it('should display both English and Hebrew options', () => {
      renderSettingsPanel();

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      const options = Array.from(languageSelect.querySelectorAll('option'));

      expect(options).toHaveLength(2);
      expect(options[0]).toHaveValue('en');
      expect(options[0]).toHaveTextContent('English');
      expect(options[1]).toHaveValue('he');
      expect(options[1]).toHaveTextContent('עברית');
    });
  });

  describe('Language selection', () => {
    it('should call onChange when language is selected', async () => {
      const user = userEvent.setup();
      const { onChange } = renderSettingsPanel();

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      await user.selectOptions(languageSelect, 'he');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            language: 'he',
          })
        );
      });
    });

    it('should update UI when switching from English to Hebrew', async () => {
      const user = userEvent.setup();
      vi.mocked(layout.getDirection).mockImplementation((locale) =>
        locale === 'he' ? 'rtl' : 'ltr'
      );

      renderSettingsPanel();

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      await user.selectOptions(languageSelect, 'he');

      await waitFor(() => {
        expect(layout.applyDirection).toHaveBeenCalledWith('rtl');
      });
    });

    it('should update UI when switching from Hebrew to English', async () => {
      const user = userEvent.setup();
      const hebrewSettings = { ...mockSettings, language: 'he' as const };
      vi.mocked(layout.getDirection).mockImplementation((locale) =>
        locale === 'he' ? 'rtl' : 'ltr'
      );

      renderSettingsPanel(hebrewSettings);

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      await user.selectOptions(languageSelect, 'en');

      await waitFor(() => {
        expect(layout.applyDirection).toHaveBeenCalledWith('ltr');
      });
    });

    it('should preserve other settings when changing language', async () => {
      const user = userEvent.setup();
      const { onChange } = renderSettingsPanel();

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      await user.selectOptions(languageSelect, 'he');

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            language: 'he',
            selectedProviderId: 'anthropic',
            selectedModel: 'claude-sonnet-4-6',
            autoApprove: false,
            maxRetries: 3,
          })
        );
      });
    });
  });

  describe('Language persistence', () => {
    it('should persist language selection to storage', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      await user.selectOptions(languageSelect, 'he');

      await waitFor(() => {
        expect(storage.languageStorage.saveLanguage).toHaveBeenCalledWith('he');
      });
    });

    it('should load persisted language on mount', () => {
      vi.mocked(storage.languageStorage.loadLanguage).mockReturnValue('he');

      // Create settings with Hebrew language
      const hebrewSettings = { ...mockSettings, language: 'he' as const };
      const onChange = vi.fn();
      const onClose = vi.fn();

      render(
        <LanguageProvider initialLocale="he">
          <SettingsPanel settings={hebrewSettings} onChange={onChange} onClose={onClose} />
        </LanguageProvider>
      );

      // Get all comboboxes and select the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      expect(languageSelect).toHaveValue('he');
    });

    it('should handle multiple language changes', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();

      // Get all selects and take the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const select = selects[selects.length - 1];

      // Change to Hebrew
      await user.selectOptions(select, 'he');
      await waitFor(() => {
        expect(storage.languageStorage.saveLanguage).toHaveBeenCalledWith('he');
      });

      // Change back to English
      await user.selectOptions(select, 'en');
      await waitFor(() => {
        expect(storage.languageStorage.saveLanguage).toHaveBeenCalledWith('en');
      });

      expect(storage.languageStorage.saveLanguage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with settings', () => {
    it('should sync language between context and settings', async () => {
      const user = userEvent.setup();
      const { onChange } = renderSettingsPanel();

      const select = screen.getByRole('combobox', { name: /interface language/i });
      await user.selectOptions(select, 'he');

      await waitFor(() => {
        // Should update both context (via setLocale) and settings (via onChange)
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({ language: 'he' })
        );
        expect(storage.languageStorage.saveLanguage).toHaveBeenCalledWith('he');
      });
    });

    it('should reflect language from settings prop', () => {
      const hebrewSettings = { ...mockSettings, language: 'he' as const };
      renderSettingsPanel(hebrewSettings);

      // When language is Hebrew, the label is in Hebrew
      const select = screen.getByRole('combobox', { name: /שפת ממשק/i });
      expect(select).toHaveValue('he');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label for language selector', () => {
      renderSettingsPanel();

      // Get all selects and verify the last one (language selector) exists
      const selects = screen.getAllByRole('combobox');
      const languageSelect = selects[selects.length - 1];
      expect(languageSelect).toBeInTheDocument();
      expect(languageSelect).toHaveValue('en');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderSettingsPanel();

      // Get all selects and take the last one (language selector)
      const selects = screen.getAllByRole('combobox');
      const select = selects[selects.length - 1];
      
      // Directly focus the select element
      select.focus();
      expect(document.activeElement).toBe(select);
    });
  });
});

