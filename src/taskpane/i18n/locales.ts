import { Locale, LocaleInfo } from './types';

/**
 * Configuration for all supported locales
 */
export const LOCALE_CONFIG: Record<Locale, LocaleInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
  },
  he: {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    direction: 'rtl',
  },
};

/**
 * Get locale information by code
 */
export function getLocaleInfo(locale: Locale): LocaleInfo {
  return LOCALE_CONFIG[locale];
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): LocaleInfo[] {
  return Object.values(LOCALE_CONFIG);
}

/**
 * Check if a locale code is supported
 */
export function isValidLocale(locale: string): locale is Locale {
  return locale === 'en' || locale === 'he';
}
