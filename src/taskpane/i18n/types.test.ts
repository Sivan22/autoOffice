import { describe, it, expect } from 'vitest';
import type { Locale, LocaleInfo, TranslationDictionary, Translations, TranslationKeys } from './types';

describe('Translation Data Structures', () => {
  describe('Locale type', () => {
    it('should accept valid locale codes', () => {
      const enLocale: Locale = 'en';
      const heLocale: Locale = 'he';
      
      expect(enLocale).toBe('en');
      expect(heLocale).toBe('he');
    });
  });

  describe('LocaleInfo interface', () => {
    it('should have correct structure for English locale', () => {
      const localeInfo: LocaleInfo = {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
      };

      expect(localeInfo.code).toBe('en');
      expect(localeInfo.name).toBe('English');
      expect(localeInfo.nativeName).toBe('English');
      expect(localeInfo.direction).toBe('ltr');
    });

    it('should have correct structure for Hebrew locale', () => {
      const localeInfo: LocaleInfo = {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית',
        direction: 'rtl',
      };

      expect(localeInfo.code).toBe('he');
      expect(localeInfo.name).toBe('Hebrew');
      expect(localeInfo.nativeName).toBe('עברית');
      expect(localeInfo.direction).toBe('rtl');
    });

    it('should only accept ltr or rtl for direction', () => {
      const ltrLocale: LocaleInfo = {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
      };

      const rtlLocale: LocaleInfo = {
        code: 'he',
        name: 'Hebrew',
        nativeName: 'עברית',
        direction: 'rtl',
      };

      expect(ltrLocale.direction).toBe('ltr');
      expect(rtlLocale.direction).toBe('rtl');
    });
  });

  describe('TranslationDictionary interface', () => {
    it('should accept flat string values', () => {
      const dict: TranslationDictionary = {
        hello: 'Hello',
        goodbye: 'Goodbye',
      };

      expect(dict.hello).toBe('Hello');
      expect(dict.goodbye).toBe('Goodbye');
    });

    it('should accept nested objects', () => {
      const dict: TranslationDictionary = {
        common: {
          appName: 'AutoOffice',
          loading: 'Loading...',
        },
        settings: {
          title: 'Settings',
        },
      };

      expect(typeof dict.common).toBe('object');
      expect(typeof dict.settings).toBe('object');
    });

    it('should accept deeply nested structures', () => {
      const dict: TranslationDictionary = {
        level1: {
          level2: {
            level3: 'Deep value',
          },
        },
      };

      expect(typeof dict.level1).toBe('object');
    });

    it('should accept mixed string and object values', () => {
      const dict: TranslationDictionary = {
        simpleKey: 'Simple value',
        nested: {
          key: 'Nested value',
        },
      };

      expect(dict.simpleKey).toBe('Simple value');
      expect(typeof dict.nested).toBe('object');
    });
  });

  describe('Translations interface', () => {
    it('should require both en and he dictionaries', () => {
      const translations: Translations = {
        en: {
          hello: 'Hello',
        },
        he: {
          hello: 'שלום',
        },
      };

      expect(translations.en).toBeDefined();
      expect(translations.he).toBeDefined();
    });

    it('should accept nested translation structures', () => {
      const translations: Translations = {
        en: {
          common: {
            appName: 'AutoOffice',
          },
        },
        he: {
          common: {
            appName: 'AutoOffice',
          },
        },
      };

      expect(translations.en.common).toBeDefined();
      expect(translations.he.common).toBeDefined();
    });
  });

  describe('TranslationKeys interface', () => {
    it('should define common section structure', () => {
      const keys: TranslationKeys['common'] = {
        appName: 'AutoOffice',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        close: 'Close',
      };

      expect(keys.appName).toBeDefined();
      expect(keys.loading).toBeDefined();
      expect(keys.error).toBeDefined();
      expect(keys.success).toBeDefined();
      expect(keys.cancel).toBeDefined();
      expect(keys.save).toBeDefined();
      expect(keys.close).toBeDefined();
    });

    it('should define chat section structure', () => {
      const keys: TranslationKeys['chat'] = {
        welcomeTitle: 'Welcome',
        welcomeMessage: 'Message',
        exampleWord: 'Example',
        exampleExcel: 'Example',
        inputPlaceholder: 'Placeholder',
        sendButton: 'Send',
      };

      expect(keys.welcomeTitle).toBeDefined();
      expect(keys.welcomeMessage).toBeDefined();
      expect(keys.exampleWord).toBeDefined();
      expect(keys.exampleExcel).toBeDefined();
      expect(keys.inputPlaceholder).toBeDefined();
      expect(keys.sendButton).toBeDefined();
    });

    it('should define settings section structure', () => {
      const keys: TranslationKeys['settings'] = {
        title: 'Settings',
        backButton: 'Back',
        providerSection: 'Provider',
        providerLabel: 'Provider',
        providerPlaceholder: 'Select...',
        apiKeyLabel: 'API Key',
        apiKeyPlaceholder: 'Enter...',
        baseUrlLabel: 'Base URL',
        baseUrlPlaceholder: 'http://...',
        modelLabel: 'Model',
        modelPlaceholder: 'Enter...',
        executionSection: 'Execution',
        autoApproveLabel: 'Auto-approve',
        maxRetriesLabel: 'Max retries',
        timeoutLabel: 'Timeout',
        mcpSection: 'MCP',
        mcpAddButton: 'Add',
        mcpNoServers: 'No servers',
        mcpNamePlaceholder: 'Name',
        mcpUrlPlaceholder: 'URL',
        languageSection: 'Language',
        languageLabel: 'Language',
        languagePlaceholder: 'Select...',
      };

      expect(keys.title).toBeDefined();
      expect(keys.languageSection).toBeDefined();
      expect(keys.languageLabel).toBeDefined();
    });

    it('should define code section structure', () => {
      const keys: TranslationKeys['code'] = {
        approveButton: 'Approve',
        rejectButton: 'Reject',
        awaitingApprovalStatus: 'Awaiting',
        rejectedStatus: 'Rejected',
        runningStatus: 'Running',
        successStatus: 'Success',
        errorStatus: 'Error',
        errorDetails: 'Details',
        result: 'Result',
        toolActivity: 'Activity',
      };

      expect(keys.approveButton).toBeDefined();
      expect(keys.rejectButton).toBeDefined();
      expect(keys.awaitingApprovalStatus).toBeDefined();
      expect(keys.successStatus).toBeDefined();
      expect(keys.errorStatus).toBeDefined();
    });

    it('should define errors section structure', () => {
      const keys: TranslationKeys['errors'] = {
        executionFailed: 'Failed',
        networkError: 'Network error',
        invalidApiKey: 'Invalid key',
        timeout: 'Timeout',
        unknownError: 'Unknown',
        codeRejected: 'Rejected',
        maxRetriesReached: 'Max retries',
        pleaseFixAndRetry: 'Fix and retry',
        streamError: 'Stream error',
      };

      expect(keys.executionFailed).toBeDefined();
      expect(keys.networkError).toBeDefined();
      expect(keys.invalidApiKey).toBeDefined();
      expect(keys.timeout).toBeDefined();
      expect(keys.unknownError).toBeDefined();
    });
  });
});
