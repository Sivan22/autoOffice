import { Locale, LocaleInfo, TranslationDictionary } from './types';
import { getAvailableLocales, isValidLocale } from './locales';
import { en, he } from './translations';

/**
 * Translation service interface
 */
export interface TranslationService {
  /**
   * Get translated string by key
   * @param key - Translation key (e.g., "settings.title")
   * @param params - Optional parameters for interpolation
   * @returns Translated string
   */
  t(key: string, params?: Record<string, string | number>): string;
  
  /**
   * Get current locale
   */
  getLocale(): Locale;
  
  /**
   * Set current locale
   */
  setLocale(locale: Locale): void;
  
  /**
   * Get all available locales
   */
  getAvailableLocales(): LocaleInfo[];
  
  /**
   * Check if a translation key exists
   */
  hasKey(key: string, locale?: Locale): boolean;
}

/**
 * All translations indexed by locale
 */
const translations: Record<Locale, TranslationDictionary> = {
  en,
  he,
};

/**
 * Implementation of the translation service
 */
class TranslationServiceImpl implements TranslationService {
  private currentLocale: Locale = 'en';

  /**
   * Get a nested value from an object using dot notation
   * @param obj - Object to search in
   * @param path - Dot-separated path (e.g., "settings.title")
   * @returns The value at the path, or undefined if not found
   */
  private getNestedValue(obj: TranslationDictionary, path: string): string | undefined {
    const keys = path.split('.');
    let current: any = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Interpolate parameters into a translation string
   * @param template - Translation string with {{param}} placeholders
   * @param params - Parameters to interpolate
   * @returns Interpolated string
   */
  private interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) {
      return template;
    }

    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return key in params ? String(params[key]) : match;
    });
  }

  /**
   * Get translated string by key
   * Falls back to English if translation is missing in the current locale
   */
  t(key: string, params?: Record<string, string | number>): string {
    // Try to get translation in current locale
    const currentTranslation = this.getNestedValue(translations[this.currentLocale], key);
    
    if (currentTranslation !== undefined) {
      return this.interpolate(currentTranslation, params);
    }

    // Fallback to English if not found
    if (this.currentLocale !== 'en') {
      const englishTranslation = this.getNestedValue(translations.en, key);
      if (englishTranslation !== undefined) {
        return this.interpolate(englishTranslation, params);
      }
    }

    // Return the key itself if no translation found (for debugging)
    return key;
  }

  /**
   * Get current locale
   */
  getLocale(): Locale {
    return this.currentLocale;
  }

  /**
   * Set current locale
   */
  setLocale(locale: Locale): void {
    if (!isValidLocale(locale)) {
      console.warn(`Invalid locale: ${locale}. Falling back to 'en'.`);
      this.currentLocale = 'en';
      return;
    }
    this.currentLocale = locale;
  }

  /**
   * Get all available locales
   */
  getAvailableLocales(): LocaleInfo[] {
    return getAvailableLocales();
  }

  /**
   * Check if a translation key exists
   */
  hasKey(key: string, locale?: Locale): boolean {
    const targetLocale = locale || this.currentLocale;
    
    if (!isValidLocale(targetLocale)) {
      return false;
    }

    const value = this.getNestedValue(translations[targetLocale], key);
    return value !== undefined;
  }
}

/**
 * Singleton instance of the translation service
 */
export const translationService: TranslationService = new TranslationServiceImpl();
