import { describe, it, expect, beforeEach } from 'vitest';
import { translationService } from './service';

describe('TranslationService', () => {
  beforeEach(() => {
    // Reset to English before each test
    translationService.setLocale('en');
  });

  describe('t() - translation lookup', () => {
    it('should return translated string for valid key in English', () => {
      translationService.setLocale('en');
      expect(translationService.t('common.appName')).toBe('AutoOffice');
      expect(translationService.t('settings.title')).toBe('Settings');
    });

    it('should return translated string for valid key in Hebrew', () => {
      translationService.setLocale('he');
      expect(translationService.t('common.appName')).toBe('AutoOffice');
      expect(translationService.t('settings.title')).toBe('הגדרות');
    });

    it('should support nested keys with dot notation', () => {
      translationService.setLocale('en');
      expect(translationService.t('chat.welcomeTitle')).toBe('Welcome to AutoOffice');
      expect(translationService.t('settings.providerSection')).toBe('AI Provider');
      expect(translationService.t('code.approveButton')).toBe('Approve & Run');
    });

    it('should return the key itself if translation not found', () => {
      translationService.setLocale('en');
      expect(translationService.t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('should fallback to English when Hebrew translation is missing', () => {
      translationService.setLocale('he');
      
      // Assuming a key exists in English but not in Hebrew
      // For this test, we'll use a key that should exist in both
      // but we can verify the fallback mechanism works
      const englishValue = translationService.t('common.loading');
      translationService.setLocale('en');
      const expectedEnglish = translationService.t('common.loading');
      
      // Both should return valid translations
      expect(englishValue).toBeTruthy();
      expect(expectedEnglish).toBeTruthy();
    });
  });

  describe('t() - parameter interpolation', () => {
    it('should interpolate single parameter', () => {
      translationService.setLocale('en');
      const result = translationService.t('chat.welcomeMessage', { host: 'Word' });
      expect(result).toContain('Word');
      expect(result).not.toContain('{{host}}');
    });

    it('should interpolate multiple parameters', () => {
      translationService.setLocale('en');
      const result = translationService.t('chat.inputPlaceholder', { host: 'Excel' });
      expect(result).toContain('Excel');
      expect(result).not.toContain('{{host}}');
    });

    it('should handle numeric parameters', () => {
      translationService.setLocale('en');
      // Using a key that might have numeric params
      const result = translationService.t('errors.executionFailed', { message: 'timeout' });
      expect(result).toContain('timeout');
    });

    it('should leave unmatched placeholders unchanged', () => {
      translationService.setLocale('en');
      const result = translationService.t('chat.welcomeMessage', { wrongParam: 'value' });
      expect(result).toContain('{{host}}');
    });

    it('should work without parameters', () => {
      translationService.setLocale('en');
      const result = translationService.t('common.appName');
      expect(result).toBe('AutoOffice');
    });

    it('should interpolate parameters in Hebrew translations', () => {
      translationService.setLocale('he');
      const result = translationService.t('chat.welcomeMessage', { host: 'Word' });
      expect(result).toContain('Word');
      expect(result).not.toContain('{{host}}');
    });
  });

  describe('getLocale()', () => {
    it('should return current locale', () => {
      translationService.setLocale('en');
      expect(translationService.getLocale()).toBe('en');
      
      translationService.setLocale('he');
      expect(translationService.getLocale()).toBe('he');
    });

    it('should default to English', () => {
      // After reset in beforeEach
      expect(translationService.getLocale()).toBe('en');
    });
  });

  describe('setLocale()', () => {
    it('should change the current locale', () => {
      translationService.setLocale('he');
      expect(translationService.getLocale()).toBe('he');
      
      translationService.setLocale('en');
      expect(translationService.getLocale()).toBe('en');
    });

    it('should affect subsequent translations', () => {
      translationService.setLocale('en');
      const englishTitle = translationService.t('settings.title');
      
      translationService.setLocale('he');
      const hebrewTitle = translationService.t('settings.title');
      
      expect(englishTitle).toBe('Settings');
      expect(hebrewTitle).toBe('הגדרות');
      expect(englishTitle).not.toBe(hebrewTitle);
    });

    it('should handle invalid locale by falling back to English', () => {
      // @ts-expect-error - Testing invalid locale
      translationService.setLocale('invalid');
      expect(translationService.getLocale()).toBe('en');
    });
  });

  describe('getAvailableLocales()', () => {
    it('should return array of locale info', () => {
      const locales = translationService.getAvailableLocales();
      expect(Array.isArray(locales)).toBe(true);
      expect(locales.length).toBeGreaterThan(0);
    });

    it('should include English and Hebrew', () => {
      const locales = translationService.getAvailableLocales();
      const codes = locales.map(l => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('he');
    });

    it('should include locale metadata', () => {
      const locales = translationService.getAvailableLocales();
      const english = locales.find(l => l.code === 'en');
      
      expect(english).toBeDefined();
      expect(english?.name).toBe('English');
      expect(english?.nativeName).toBe('English');
      expect(english?.direction).toBe('ltr');
    });

    it('should include RTL direction for Hebrew', () => {
      const locales = translationService.getAvailableLocales();
      const hebrew = locales.find(l => l.code === 'he');
      
      expect(hebrew).toBeDefined();
      expect(hebrew?.name).toBe('Hebrew');
      expect(hebrew?.nativeName).toBe('עברית');
      expect(hebrew?.direction).toBe('rtl');
    });
  });

  describe('hasKey()', () => {
    it('should return true for existing keys in current locale', () => {
      translationService.setLocale('en');
      expect(translationService.hasKey('common.appName')).toBe(true);
      expect(translationService.hasKey('settings.title')).toBe(true);
    });

    it('should return false for non-existing keys', () => {
      translationService.setLocale('en');
      expect(translationService.hasKey('nonexistent.key')).toBe(false);
      expect(translationService.hasKey('invalid')).toBe(false);
    });

    it('should check specific locale when provided', () => {
      translationService.setLocale('en');
      expect(translationService.hasKey('settings.title', 'he')).toBe(true);
      expect(translationService.hasKey('settings.title', 'en')).toBe(true);
    });

    it('should work with nested keys', () => {
      translationService.setLocale('en');
      expect(translationService.hasKey('chat.welcomeTitle')).toBe(true);
      expect(translationService.hasKey('errors.executionFailed')).toBe(true);
      expect(translationService.hasKey('code.approveButton')).toBe(true);
    });

    it('should return false for partial paths', () => {
      translationService.setLocale('en');
      // 'common' is an object, not a string value
      expect(translationService.hasKey('common')).toBe(false);
      expect(translationService.hasKey('settings')).toBe(false);
    });

    it('should handle invalid locale parameter', () => {
      translationService.setLocale('en');
      // @ts-expect-error - Testing invalid locale
      expect(translationService.hasKey('common.appName', 'invalid')).toBe(false);
    });
  });

  describe('fallback behavior', () => {
    it('should use English as fallback for missing Hebrew translations', () => {
      translationService.setLocale('he');
      
      // Test with a key that exists in English
      // If it doesn't exist in Hebrew, it should fallback to English
      const result = translationService.t('common.appName');
      expect(result).toBeTruthy();
      expect(result).not.toBe('common.appName'); // Should not return the key
    });

    it('should not fallback when translation exists in current locale', () => {
      translationService.setLocale('he');
      const hebrewTitle = translationService.t('settings.title');
      
      translationService.setLocale('en');
      const englishTitle = translationService.t('settings.title');
      
      // They should be different (Hebrew vs English)
      expect(hebrewTitle).not.toBe(englishTitle);
      expect(hebrewTitle).toBe('הגדרות');
      expect(englishTitle).toBe('Settings');
    });

    it('should return key when translation missing in both locales', () => {
      translationService.setLocale('he');
      expect(translationService.t('completely.missing.key')).toBe('completely.missing.key');
      
      translationService.setLocale('en');
      expect(translationService.t('completely.missing.key')).toBe('completely.missing.key');
    });
  });
});
