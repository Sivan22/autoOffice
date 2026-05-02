import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Locale, LocaleInfo } from './types';
import { translationService } from './service';
import { languageStorage } from './storage';
import { getDirection, applyDirection } from './layout';
import { getAvailableLocales } from './locales';

/**
 * Language context value interface
 */
export interface LanguageContextValue {
  /** Current locale */
  locale: Locale;
  
  /** Set current locale */
  setLocale: (locale: Locale) => void;
  
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  
  /** Current text direction */
  direction: 'ltr' | 'rtl';
  
  /** Available locales */
  availableLocales: LocaleInfo[];
}

/**
 * Language context
 */
export const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Props for LanguageProvider
 */
export interface LanguageProviderProps {
  /** Child components */
  children: ReactNode;
  
  /** Optional initial locale (overrides storage) */
  initialLocale?: Locale;
}

/**
 * Language provider component
 * Manages language state and provides translation functionality to child components
 */
export function LanguageProvider({ children, initialLocale }: LanguageProviderProps) {
  // Force re-render counter when locale changes
  const [, forceUpdate] = useState(0);
  
  // Initialize locale from storage or detection
  const [locale, setLocaleState] = useState<Locale>(() => {
    let detectedLocale: Locale;
    
    if (initialLocale) {
      detectedLocale = initialLocale;
    } else {
      // Try to load from storage
      const savedLocale = languageStorage.loadLanguage();
      if (savedLocale) {
        detectedLocale = savedLocale;
      } else {
        // Detect from browser/Office
        detectedLocale = languageStorage.detectLanguage();
      }
    }
    
    // Initialize translation service immediately with the detected locale
    translationService.setLocale(detectedLocale);
    
    return detectedLocale;
  });

  // Initialize translation service with current locale
  useEffect(() => {
    translationService.setLocale(locale);
  }, [locale]);

  // Apply direction to document when locale changes
  useEffect(() => {
    const direction = getDirection(locale);
    applyDirection(direction);
  }, [locale]);

  // Set locale and persist to storage
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    languageStorage.saveLanguage(newLocale);
    translationService.setLocale(newLocale);
    
    // Force re-render to update all translations
    forceUpdate(prev => prev + 1);
    
    // Announce language change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    
    const localeInfo = getAvailableLocales().find(l => l.code === newLocale);
    announcement.textContent = `Language changed to ${localeInfo?.nativeName || newLocale}`;
    
    document.body.appendChild(announcement);
    
    // Remove announcement after it's been read
    setTimeout(() => {
      try {
        if (announcement.parentNode === document.body) {
          document.body.removeChild(announcement);
        }
      } catch (e) {
        // Ignore errors if element was already removed
      }
    }, 1000);
  }, []);

  // Translation function - depends on locale to re-render when language changes
  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    return translationService.t(key, params);
  }, [locale]);

  // Get current direction
  const direction = getDirection(locale);

  // Get available locales
  const availableLocales = getAvailableLocales();

  const value: LanguageContextValue = {
    locale,
    setLocale,
    t,
    direction,
    availableLocales,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * @throws Error if used outside LanguageProvider
 */
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  
  return context;
}
