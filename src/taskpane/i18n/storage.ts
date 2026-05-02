import type { Locale } from './types';

/**
 * Storage service interface for language persistence
 */
export interface LanguageStorageService {
  /**
   * Load saved language preference
   * @returns Saved locale or null if not found
   */
  loadLanguage(): Locale | null;
  
  /**
   * Save language preference
   * @param locale - Locale to save
   */
  saveLanguage(locale: Locale): void;
  
  /**
   * Detect browser/Office language
   * @returns Detected locale or default
   */
  detectLanguage(): Locale;
}

const STORAGE_KEY = 'autooffice_language';

/**
 * Check if running in Office environment with roamingSettings available
 */
function isOfficeEnvironment(): boolean {
  return typeof Office !== 'undefined' && !!Office.context?.roamingSettings;
}

/**
 * Normalize language code to supported locale
 * @param langCode - Language code (e.g., 'en', 'en-US', 'he', 'he-IL')
 * @returns Normalized locale or null if not supported
 */
function normalizeLanguageCode(langCode: string): Locale | null {
  const normalized = langCode.toLowerCase().split('-')[0];
  
  if (normalized === 'en') return 'en';
  if (normalized === 'he' || normalized === 'iw') return 'he'; // 'iw' is old Hebrew code
  
  return null;
}

/**
 * Detect language from browser or Office environment
 * @returns Detected locale or 'en' as default
 */
export function detectLanguage(): Locale {
  try {
    // Try Office display language first
    if (typeof Office !== 'undefined' && Office.context?.displayLanguage) {
      const detected = normalizeLanguageCode(Office.context.displayLanguage);
      if (detected) return detected;
    }
    
    // Try browser language
    if (typeof navigator !== 'undefined') {
      const browserLang = navigator.language || (navigator as any).userLanguage;
      if (browserLang) {
        const detected = normalizeLanguageCode(browserLang);
        if (detected) return detected;
      }
    }
  } catch {
    // Fall through to default
  }
  
  // Default to English
  return 'en';
}

/**
 * Load saved language preference from storage
 * @returns Saved locale or null if not found
 */
export function loadLanguage(): Locale | null {
  try {
    if (isOfficeEnvironment()) {
      // Use Office roaming settings
      const saved = Office.context.roamingSettings.get(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'he')) {
        return saved as Locale;
      }
    } else {
      // Use localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'he')) {
        return saved as Locale;
      }
    }
  } catch {
    // Storage error - return null to trigger detection
  }
  
  return null;
}

/**
 * Save language preference to storage
 * @param locale - Locale to save
 */
export function saveLanguage(locale: Locale): void {
  try {
    if (isOfficeEnvironment()) {
      // Use Office roaming settings
      Office.context.roamingSettings.set(STORAGE_KEY, locale);
      Office.context.roamingSettings.saveAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          console.error('Failed to save language preference:', result.error?.message);
        }
      });
    } else {
      // Use localStorage
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch (error) {
    // Silent failure - language preference will not persist
    console.error('Failed to save language preference:', error);
  }
}

/**
 * Default implementation of LanguageStorageService
 */
export const languageStorage: LanguageStorageService = {
  loadLanguage,
  saveLanguage,
  detectLanguage,
};
