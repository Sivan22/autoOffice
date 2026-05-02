// Public API exports for i18n module

// Types
export type { Locale, LocaleInfo, TranslationDictionary, Translations } from './types';

// Locale configuration
export { LOCALE_CONFIG } from './locales';

// Translation service
export { translationService } from './service';

// Storage service
export { languageStorage } from './storage';

// Layout service
export { layoutService } from './layout';

// Context and Provider
export { LanguageContext, LanguageProvider } from './context';

// Hooks
export { useTranslation, useDirection } from './hooks';

// RTL-aware styles
export * from './styles';
