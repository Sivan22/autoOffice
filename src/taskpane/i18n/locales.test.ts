import { describe, it, expect } from 'vitest';
import { LOCALE_CONFIG, getLocaleInfo, getAvailableLocales, isValidLocale } from './locales';
import type { Locale, LocaleInfo } from './types';

describe('Locale Configuration', () => {
  describe('LOCALE_CONFIG', () => {
    it('should contain English locale configuration', () => {
      expect(LOCALE_CONFIG.en).toBeDefined();
      expect(LOCALE_CONFIG.en.code).toBe('en');
      expect(LOCALE_CONFIG.en.name).toBe('English');
      expect(LOCALE_CONFIG.en.nativeName).toBe('English');
      expect(LOCALE_CONFIG.en.direction).toBe('ltr');
    });

    it('should contain Hebrew locale configuration', () => {
      expect(LOCALE_CONFIG.he).toBeDefined();
      expect(LOCALE_CONFIG.he.code).toBe('he');
      expect(LOCALE_CONFIG.he.name).toBe('Hebrew');
      expect(LOCALE_CONFIG.he.nativeName).toBe('עברית');
      expect(LOCALE_CONFIG.he.direction).toBe('rtl');
    });

    it('should have exactly two locales', () => {
      const locales = Object.keys(LOCALE_CONFIG);
      expect(locales).toHaveLength(2);
      expect(locales).toContain('en');
      expect(locales).toContain('he');
    });

    it('should have consistent structure for all locales', () => {
      Object.values(LOCALE_CONFIG).forEach((locale: LocaleInfo) => {
        expect(locale).toHaveProperty('code');
        expect(locale).toHaveProperty('name');
        expect(locale).toHaveProperty('nativeName');
        expect(locale).toHaveProperty('direction');
        expect(['ltr', 'rtl']).toContain(locale.direction);
      });
    });

    it('should have locale codes matching their keys', () => {
      Object.entries(LOCALE_CONFIG).forEach(([key, locale]) => {
        expect(locale.code).toBe(key);
      });
    });
  });

  describe('getLocaleInfo', () => {
    it('should return correct info for English locale', () => {
      const info = getLocaleInfo('en');
      expect(info.code).toBe('en');
      expect(info.name).toBe('English');
      expect(info.nativeName).toBe('English');
      expect(info.direction).toBe('ltr');
    });

    it('should return correct info for Hebrew locale', () => {
      const info = getLocaleInfo('he');
      expect(info.code).toBe('he');
      expect(info.name).toBe('Hebrew');
      expect(info.nativeName).toBe('עברית');
      expect(info.direction).toBe('rtl');
    });

    it('should return the same object as in LOCALE_CONFIG', () => {
      const enInfo = getLocaleInfo('en');
      expect(enInfo).toBe(LOCALE_CONFIG.en);

      const heInfo = getLocaleInfo('he');
      expect(heInfo).toBe(LOCALE_CONFIG.he);
    });
  });

  describe('getAvailableLocales', () => {
    it('should return an array of locale info objects', () => {
      const locales = getAvailableLocales();
      expect(Array.isArray(locales)).toBe(true);
      expect(locales).toHaveLength(2);
    });

    it('should include English locale info', () => {
      const locales = getAvailableLocales();
      const enLocale = locales.find((l) => l.code === 'en');
      expect(enLocale).toBeDefined();
      expect(enLocale?.name).toBe('English');
    });

    it('should include Hebrew locale info', () => {
      const locales = getAvailableLocales();
      const heLocale = locales.find((l) => l.code === 'he');
      expect(heLocale).toBeDefined();
      expect(heLocale?.name).toBe('Hebrew');
    });

    it('should return all locale info objects from LOCALE_CONFIG', () => {
      const locales = getAvailableLocales();
      const configValues = Object.values(LOCALE_CONFIG);
      
      expect(locales).toHaveLength(configValues.length);
      locales.forEach((locale) => {
        expect(configValues).toContain(locale);
      });
    });
  });

  describe('isValidLocale', () => {
    it('should return true for "en"', () => {
      expect(isValidLocale('en')).toBe(true);
    });

    it('should return true for "he"', () => {
      expect(isValidLocale('he')).toBe(true);
    });

    it('should return false for unsupported locale codes', () => {
      expect(isValidLocale('fr')).toBe(false);
      expect(isValidLocale('es')).toBe(false);
      expect(isValidLocale('de')).toBe(false);
    });

    it('should return false for invalid strings', () => {
      expect(isValidLocale('')).toBe(false);
      expect(isValidLocale('invalid')).toBe(false);
      expect(isValidLocale('EN')).toBe(false); // Case sensitive
    });

    it('should return false for non-string values', () => {
      expect(isValidLocale(null as any)).toBe(false);
      expect(isValidLocale(undefined as any)).toBe(false);
      expect(isValidLocale(123 as any)).toBe(false);
    });

    it('should act as a type guard', () => {
      const testLocale: string = 'en';
      
      if (isValidLocale(testLocale)) {
        // TypeScript should recognize testLocale as Locale type here
        const locale: Locale = testLocale;
        expect(locale).toBe('en');
      }
    });
  });

  describe('Locale Configuration Type Safety', () => {
    it('should ensure all locales have required properties', () => {
      const requiredProps = ['code', 'name', 'nativeName', 'direction'];
      
      Object.values(LOCALE_CONFIG).forEach((locale) => {
        requiredProps.forEach((prop) => {
          expect(locale).toHaveProperty(prop);
          expect((locale as any)[prop]).toBeTruthy();
        });
      });
    });

    it('should ensure direction is either ltr or rtl', () => {
      Object.values(LOCALE_CONFIG).forEach((locale) => {
        expect(['ltr', 'rtl']).toContain(locale.direction);
      });
    });

    it('should ensure code matches Locale type', () => {
      const validCodes: Locale[] = ['en', 'he'];
      
      Object.values(LOCALE_CONFIG).forEach((locale) => {
        expect(validCodes).toContain(locale.code);
      });
    });

    it('should ensure name and nativeName are non-empty strings', () => {
      Object.values(LOCALE_CONFIG).forEach((locale) => {
        expect(typeof locale.name).toBe('string');
        expect(locale.name.length).toBeGreaterThan(0);
        expect(typeof locale.nativeName).toBe('string');
        expect(locale.nativeName.length).toBeGreaterThan(0);
      });
    });
  });
});
