import { useContext } from 'react';
import { LanguageContext } from './context';

/**
 * Hook to access translation functionality
 * Provides access to translation function, current locale, locale setter, and available locales
 * 
 * @throws Error if used outside LanguageProvider
 * @returns Translation context with t, locale, setLocale, and availableLocales
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, locale, setLocale, availableLocales } = useTranslation();
 *   return <div>{t('common.appName')}</div>;
 * }
 * ```
 */
export function useTranslation() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  
  return {
    t: context.t,
    locale: context.locale,
    setLocale: context.setLocale,
    availableLocales: context.availableLocales,
  };
}

/**
 * Hook to access text direction
 * Provides access to the current text direction (ltr or rtl)
 * 
 * @throws Error if used outside LanguageProvider
 * @returns Current text direction ('ltr' or 'rtl')
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const direction = useDirection();
 *   return <div style={{ textAlign: direction === 'rtl' ? 'right' : 'left' }}>Content</div>;
 * }
 * ```
 */
export function useDirection() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    throw new Error('useDirection must be used within LanguageProvider');
  }
  
  return context.direction;
}
