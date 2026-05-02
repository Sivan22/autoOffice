import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { LanguageProvider, useLanguage } from './context';
import * as storage from './storage';
import * as layout from './layout';

// Mock the storage and layout modules
vi.mock('./storage');
vi.mock('./layout');

describe('LanguageContext', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(storage.languageStorage.loadLanguage).mockReturnValue(null);
    vi.mocked(storage.languageStorage.detectLanguage).mockReturnValue('en');
    vi.mocked(storage.languageStorage.saveLanguage).mockImplementation(() => {});
    vi.mocked(layout.getDirection).mockReturnValue('ltr');
    vi.mocked(layout.applyDirection).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('LanguageProvider', () => {
    it('should initialize with detected language when no saved preference', () => {
      vi.mocked(storage.languageStorage.loadLanguage).mockReturnValue(null);
      vi.mocked(storage.languageStorage.detectLanguage).mockReturnValue('he');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
      });

      expect(result.current.locale).toBe('he');
      expect(storage.languageStorage.loadLanguage).toHaveBeenCalled();
      expect(storage.languageStorage.detectLanguage).toHaveBeenCalled();
    });

    it('should initialize with saved language preference', () => {
      vi.mocked(storage.languageStorage.loadLanguage).mockReturnValue('he');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
      });

      expect(result.current.locale).toBe('he');
      expect(storage.languageStorage.loadLanguage).toHaveBeenCalled();
      expect(storage.languageStorage.detectLanguage).not.toHaveBeenCalled();
    });

    it('should initialize with provided initialLocale', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      expect(result.current.locale).toBe('he');
      expect(storage.languageStorage.loadLanguage).not.toHaveBeenCalled();
      expect(storage.languageStorage.detectLanguage).not.toHaveBeenCalled();
    });

    it('should apply direction to document on mount', () => {
      vi.mocked(layout.getDirection).mockReturnValue('rtl');

      renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      expect(layout.applyDirection).toHaveBeenCalledWith('rtl');
    });

    it('should update direction when locale changes', async () => {
      vi.mocked(layout.getDirection).mockImplementation((locale) => 
        locale === 'he' ? 'rtl' : 'ltr'
      );

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      // Initial direction
      expect(layout.applyDirection).toHaveBeenCalledWith('ltr');

      // Change locale
      act(() => {
        result.current.setLocale('he');
      });

      await waitFor(() => {
        expect(layout.applyDirection).toHaveBeenCalledWith('rtl');
      });
    });

    it('should save locale to storage when changed', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      act(() => {
        result.current.setLocale('he');
      });

      expect(storage.languageStorage.saveLanguage).toHaveBeenCalledWith('he');
    });

    it('should provide translation function', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      const translated = result.current.t('common.appName');
      expect(translated).toBe('AutoOffice');
    });

    it('should provide current direction', () => {
      vi.mocked(layout.getDirection).mockReturnValue('rtl');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      expect(result.current.direction).toBe('rtl');
    });

    it('should provide available locales', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(result.current.availableLocales).toHaveLength(2);
      expect(result.current.availableLocales[0].code).toBe('en');
      expect(result.current.availableLocales[1].code).toBe('he');
    });
  });

  describe('useLanguage hook', () => {
    it('should throw error when used outside LanguageProvider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within LanguageProvider');

      consoleError.mockRestore();
    });

    it('should return context value when used inside LanguageProvider', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(result.current).toHaveProperty('locale');
      expect(result.current).toHaveProperty('setLocale');
      expect(result.current).toHaveProperty('t');
      expect(result.current).toHaveProperty('direction');
      expect(result.current).toHaveProperty('availableLocales');
    });
  });

  describe('Integration', () => {
    it('should update all context values when locale changes', async () => {
      vi.mocked(layout.getDirection).mockImplementation((locale) => 
        locale === 'he' ? 'rtl' : 'ltr'
      );

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      // Initial state
      expect(result.current.locale).toBe('en');
      expect(result.current.direction).toBe('ltr');

      // Change locale
      act(() => {
        result.current.setLocale('he');
      });

      // Verify all values updated
      await waitFor(() => {
        expect(result.current.locale).toBe('he');
        expect(result.current.direction).toBe('rtl');
      });

      expect(storage.languageStorage.saveLanguage).toHaveBeenCalledWith('he');
      expect(layout.applyDirection).toHaveBeenCalledWith('rtl');
    });

    it('should render children correctly', () => {
      render(
        <LanguageProvider initialLocale="en">
          <div data-testid="child">Test Child</div>
        </LanguageProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });
  });
});
