/**
 * Supported locale codes
 */
export type Locale = 'en' | 'he';

/**
 * Information about a locale
 */
export interface LocaleInfo {
  /** Locale code (e.g., 'en', 'he') */
  code: Locale;
  /** English name of the language */
  name: string;
  /** Native name of the language */
  nativeName: string;
  /** Text direction for this locale */
  direction: 'ltr' | 'rtl';
}

/**
 * Translation dictionary structure
 * Can contain nested objects or string values
 */
export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/**
 * Complete translations for all supported locales
 */
export interface Translations {
  en: TranslationDictionary;
  he: TranslationDictionary;
}

/**
 * Translation key structure for type safety
 */
export interface TranslationKeys {
  common: {
    appName: string;
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    close: string;
  };
  
  chat: {
    welcomeTitle: string;
    welcomeMessage: string;
    exampleWord: string;
    exampleExcel: string;
    inputPlaceholder: string;
    sendButton: string;
  };
  
  settings: {
    title: string;
    backButton: string;
    
    providerSection: string;
    providerLabel: string;
    providerPlaceholder: string;
    apiKeyLabel: string;
    apiKeyPlaceholder: string;
    baseUrlLabel: string;
    baseUrlPlaceholder: string;
    modelLabel: string;
    modelPlaceholder: string;
    
    executionSection: string;
    autoApproveLabel: string;
    maxRetriesLabel: string;
    timeoutLabel: string;
    
    mcpSection: string;
    mcpAddButton: string;
    mcpNoServers: string;
    mcpNamePlaceholder: string;
    mcpUrlPlaceholder: string;
    
    languageSection: string;
    languageLabel: string;
    languagePlaceholder: string;
  };
  
  code: {
    approveButton: string;
    rejectButton: string;
    awaitingApprovalStatus: string;
    rejectedStatus: string;
    runningStatus: string;
    successStatus: string;
    errorStatus: string;
    errorDetails: string;
    result: string;
    toolActivity: string;
  };
  
  errors: {
    executionFailed: string;
    networkError: string;
    invalidApiKey: string;
    timeout: string;
    unknownError: string;
    codeRejected: string;
    maxRetriesReached: string;
    pleaseFixAndRetry: string;
    streamError: string;
  };
}
