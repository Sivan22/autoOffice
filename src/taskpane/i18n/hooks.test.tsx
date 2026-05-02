import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useTranslation, useDirection } from './hooks';
import { LanguageProvider } from './context';
import * as storage from './storage';
import * as layout from './layout';

// Mock the storage and layout modules
vi.mock('./storage');
vi.mock('./layout');

describe('i18n hooks', () => {
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

  describe('useTranslation', () => {
    it('should throw error when used outside LanguageProvider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTranslation());
      }).toThrow('useTranslation must be used within LanguageProvider');

      consoleError.mockRestore();
    });

    it('should return translation function when used inside LanguageProvider', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(result.current).toHaveProperty('t');
      expect(typeof result.current.t).toBe('function');
    });

    it('should return current locale when used inside LanguageProvider', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      expect(result.current).toHaveProperty('locale');
      expect(result.current.locale).toBe('he');
    });

    it('should return setLocale function when used inside LanguageProvider', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(result.current).toHaveProperty('setLocale');
      expect(typeof result.current.setLocale).toBe('function');
    });

    it('should translate keys correctly', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      const translated = result.current.t('common.appName');
      expect(translated).toBe('AutoOffice');
    });

    it('should expose t, locale, setLocale, and availableLocales', () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(result.current).toHaveProperty('t');
      expect(result.current).toHaveProperty('locale');
      expect(result.current).toHaveProperty('setLocale');
      expect(result.current).toHaveProperty('availableLocales');
      expect(result.current).not.toHaveProperty('direction');
    });
  });

  describe('useDirection', () => {
    it('should throw error when used outside LanguageProvider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useDirection());
      }).toThrow('useDirection must be used within LanguageProvider');

      consoleError.mockRestore();
    });

    it('should return ltr direction for English', () => {
      vi.mocked(layout.getDirection).mockReturnValue('ltr');

      const { result } = renderHook(() => useDirection(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(result.current).toBe('ltr');
    });

    it('should return rtl direction for Hebrew', () => {
      vi.mocked(layout.getDirection).mockReturnValue('rtl');

      const { result } = renderHook(() => useDirection(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      expect(result.current).toBe('rtl');
    });

    it('should return only direction value, not an object', () => {
      vi.mocked(layout.getDirection).mockReturnValue('ltr');

      const { result } = renderHook(() => useDirection(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="en">{children}</LanguageProvider>,
      });

      expect(typeof result.current).toBe('string');
      expect(result.current).toBe('ltr');
    });
  });

  describe('Hook integration', () => {
    it('should work together in the same component', () => {
      vi.mocked(layout.getDirection).mockReturnValue('rtl');

      const { result: translationResult } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      const { result: directionResult } = renderHook(() => useDirection(), {
        wrapper: ({ children }) => <LanguageProvider initialLocale="he">{children}</LanguageProvider>,
      });

      expect(translationResult.current.locale).toBe('he');
      expect(directionResult.current).toBe('rtl');
    });
  });
});
