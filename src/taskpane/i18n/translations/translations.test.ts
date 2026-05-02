import { describe, it, expect } from 'vitest';
import { en } from './en';
import { he } from './he';
import { TranslationKeys } from '../types';

describe('Translation Dictionaries', () => {
  describe('English translations', () => {
    it('should have all required top-level sections', () => {
      expect(en).toHaveProperty('common');
      expect(en).toHaveProperty('chat');
      expect(en).toHaveProperty('settings');
      expect(en).toHaveProperty('code');
      expect(en).toHaveProperty('errors');
    });

    it('should have all common keys', () => {
      const common = en.common as Record<string, string>;
      expect(common).toHaveProperty('appName');
      expect(common).toHaveProperty('loading');
      expect(common).toHaveProperty('error');
      expect(common).toHaveProperty('success');
      expect(common).toHaveProperty('cancel');
      expect(common).toHaveProperty('save');
      expect(common).toHaveProperty('close');
    });

    it('should have all chat keys', () => {
      const chat = en.chat as Record<string, string>;
      expect(chat).toHaveProperty('welcomeTitle');
      expect(chat).toHaveProperty('welcomeMessage');
      expect(chat).toHaveProperty('exampleWord');
      expect(chat).toHaveProperty('exampleExcel');
      expect(chat).toHaveProperty('inputPlaceholder');
      expect(chat).toHaveProperty('sendButton');
    });

    it('should have all settings keys', () => {
      const settings = en.settings as Record<string, string>;
      expect(settings).toHaveProperty('title');
      expect(settings).toHaveProperty('backButton');
      
      // Provider section
      expect(settings).toHaveProperty('providerSection');
      expect(settings).toHaveProperty('providerLabel');
      expect(settings).toHaveProperty('providerPlaceholder');
      expect(settings).toHaveProperty('apiKeyLabel');
      expect(settings).toHaveProperty('apiKeyPlaceholder');
      expect(settings).toHaveProperty('baseUrlLabel');
      expect(settings).toHaveProperty('baseUrlPlaceholder');
      expect(settings).toHaveProperty('modelLabel');
      expect(settings).toHaveProperty('modelPlaceholder');
      
      // Execution section
      expect(settings).toHaveProperty('executionSection');
      expect(settings).toHaveProperty('autoApproveLabel');
      expect(settings).toHaveProperty('maxRetriesLabel');
      expect(settings).toHaveProperty('timeoutLabel');
      
      // MCP section
      expect(settings).toHaveProperty('mcpSection');
      expect(settings).toHaveProperty('mcpAddButton');
      expect(settings).toHaveProperty('mcpNoServers');
      expect(settings).toHaveProperty('mcpNamePlaceholder');
      expect(settings).toHaveProperty('mcpUrlPlaceholder');
      
      // Language section
      expect(settings).toHaveProperty('languageSection');
      expect(settings).toHaveProperty('languageLabel');
      expect(settings).toHaveProperty('languagePlaceholder');
    });

    it('should have all code keys', () => {
      const code = en.code as Record<string, string>;
      expect(code).toHaveProperty('approveButton');
      expect(code).toHaveProperty('rejectButton');
      expect(code).toHaveProperty('awaitingApprovalStatus');
      expect(code).toHaveProperty('rejectedStatus');
      expect(code).toHaveProperty('runningStatus');
      expect(code).toHaveProperty('successStatus');
      expect(code).toHaveProperty('errorStatus');
      expect(code).toHaveProperty('errorDetails');
      expect(code).toHaveProperty('result');
      expect(code).toHaveProperty('toolActivity');
    });

    it('should have all error keys', () => {
      const errors = en.errors as Record<string, string>;
      expect(errors).toHaveProperty('executionFailed');
      expect(errors).toHaveProperty('networkError');
      expect(errors).toHaveProperty('invalidApiKey');
      expect(errors).toHaveProperty('timeout');
      expect(errors).toHaveProperty('unknownError');
    });

    it('should support parameter interpolation in messages', () => {
      const chat = en.chat as Record<string, string>;
      expect(chat.welcomeMessage).toContain('{{host}}');
      expect(chat.inputPlaceholder).toContain('{{host}}');
      
      const errors = en.errors as Record<string, string>;
      expect(errors.executionFailed).toContain('{{message}}');
    });
  });

  describe('Hebrew translations', () => {
    it('should have all required top-level sections', () => {
      expect(he).toHaveProperty('common');
      expect(he).toHaveProperty('chat');
      expect(he).toHaveProperty('settings');
      expect(he).toHaveProperty('code');
      expect(he).toHaveProperty('errors');
    });

    it('should have all common keys', () => {
      const common = he.common as Record<string, string>;
      expect(common).toHaveProperty('appName');
      expect(common).toHaveProperty('loading');
      expect(common).toHaveProperty('error');
      expect(common).toHaveProperty('success');
      expect(common).toHaveProperty('cancel');
      expect(common).toHaveProperty('save');
      expect(common).toHaveProperty('close');
    });

    it('should have all chat keys', () => {
      const chat = he.chat as Record<string, string>;
      expect(chat).toHaveProperty('welcomeTitle');
      expect(chat).toHaveProperty('welcomeMessage');
      expect(chat).toHaveProperty('exampleWord');
      expect(chat).toHaveProperty('exampleExcel');
      expect(chat).toHaveProperty('inputPlaceholder');
      expect(chat).toHaveProperty('sendButton');
    });

    it('should have all settings keys', () => {
      const settings = he.settings as Record<string, string>;
      expect(settings).toHaveProperty('title');
      expect(settings).toHaveProperty('backButton');
      
      // Provider section
      expect(settings).toHaveProperty('providerSection');
      expect(settings).toHaveProperty('providerLabel');
      expect(settings).toHaveProperty('providerPlaceholder');
      expect(settings).toHaveProperty('apiKeyLabel');
      expect(settings).toHaveProperty('apiKeyPlaceholder');
      expect(settings).toHaveProperty('baseUrlLabel');
      expect(settings).toHaveProperty('baseUrlPlaceholder');
      expect(settings).toHaveProperty('modelLabel');
      expect(settings).toHaveProperty('modelPlaceholder');
      
      // Execution section
      expect(settings).toHaveProperty('executionSection');
      expect(settings).toHaveProperty('autoApproveLabel');
      expect(settings).toHaveProperty('maxRetriesLabel');
      expect(settings).toHaveProperty('timeoutLabel');
      
      // MCP section
      expect(settings).toHaveProperty('mcpSection');
      expect(settings).toHaveProperty('mcpAddButton');
      expect(settings).toHaveProperty('mcpNoServers');
      expect(settings).toHaveProperty('mcpNamePlaceholder');
      expect(settings).toHaveProperty('mcpUrlPlaceholder');
      
      // Language section
      expect(settings).toHaveProperty('languageSection');
      expect(settings).toHaveProperty('languageLabel');
      expect(settings).toHaveProperty('languagePlaceholder');
    });

    it('should have all code keys', () => {
      const code = he.code as Record<string, string>;
      expect(code).toHaveProperty('approveButton');
      expect(code).toHaveProperty('rejectButton');
      expect(code).toHaveProperty('awaitingApprovalStatus');
      expect(code).toHaveProperty('rejectedStatus');
      expect(code).toHaveProperty('runningStatus');
      expect(code).toHaveProperty('successStatus');
      expect(code).toHaveProperty('errorStatus');
      expect(code).toHaveProperty('errorDetails');
      expect(code).toHaveProperty('result');
      expect(code).toHaveProperty('toolActivity');
    });

    it('should have all error keys', () => {
      const errors = he.errors as Record<string, string>;
      expect(errors).toHaveProperty('executionFailed');
      expect(errors).toHaveProperty('networkError');
      expect(errors).toHaveProperty('invalidApiKey');
      expect(errors).toHaveProperty('timeout');
      expect(errors).toHaveProperty('unknownError');
    });

    it('should support parameter interpolation in messages', () => {
      const chat = he.chat as Record<string, string>;
      expect(chat.welcomeMessage).toContain('{{host}}');
      expect(chat.inputPlaceholder).toContain('{{host}}');
      
      const errors = he.errors as Record<string, string>;
      expect(errors.executionFailed).toContain('{{message}}');
    });
  });

  describe('Translation parity', () => {
    it('should have matching keys between English and Hebrew', () => {
      const enKeys = Object.keys(en);
      const heKeys = Object.keys(he);
      
      expect(enKeys.sort()).toEqual(heKeys.sort());
    });

    it('should have matching nested keys in common section', () => {
      const enCommon = Object.keys(en.common as Record<string, string>);
      const heCommon = Object.keys(he.common as Record<string, string>);
      
      expect(enCommon.sort()).toEqual(heCommon.sort());
    });

    it('should have matching nested keys in chat section', () => {
      const enChat = Object.keys(en.chat as Record<string, string>);
      const heChat = Object.keys(he.chat as Record<string, string>);
      
      expect(enChat.sort()).toEqual(heChat.sort());
    });

    it('should have matching nested keys in settings section', () => {
      const enSettings = Object.keys(en.settings as Record<string, string>);
      const heSettings = Object.keys(he.settings as Record<string, string>);
      
      expect(enSettings.sort()).toEqual(heSettings.sort());
    });

    it('should have matching nested keys in code section', () => {
      const enCode = Object.keys(en.code as Record<string, string>);
      const heCode = Object.keys(he.code as Record<string, string>);
      
      expect(enCode.sort()).toEqual(heCode.sort());
    });

    it('should have matching nested keys in errors section', () => {
      const enErrors = Object.keys(en.errors as Record<string, string>);
      const heErrors = Object.keys(he.errors as Record<string, string>);
      
      expect(enErrors.sort()).toEqual(heErrors.sort());
    });
  });

  describe('Structure validation', () => {
    it('should match the TranslationKeys interface structure', () => {
      // Helper function to get all nested keys from an object
      const getAllKeys = (obj: any, prefix = ''): string[] => {
        const keys: string[] = [];
        for (const key in obj) {
          const fullKey = prefix ? `${prefix}.${key}` : key;
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys.push(...getAllKeys(obj[key], fullKey));
          } else {
            keys.push(fullKey);
          }
        }
        return keys;
      };

      const enKeys = getAllKeys(en).sort();
      const heKeys = getAllKeys(he).sort();

      // Both dictionaries should have the same structure
      expect(enKeys).toEqual(heKeys);

      // Verify all expected top-level sections exist
      const expectedSections = ['common', 'chat', 'settings', 'code', 'errors'];
      expectedSections.forEach(section => {
        expect(en).toHaveProperty(section);
        expect(he).toHaveProperty(section);
      });

      // Verify minimum number of keys (ensures completeness)
      expect(enKeys.length).toBeGreaterThan(30); // We have at least 30+ translation keys
    });

    it('should have all values as strings (no nested objects beyond first level)', () => {
      const checkValues = (obj: any, section: string) => {
        for (const key in obj) {
          const value = obj[key];
          if (typeof value === 'object' && value !== null) {
            // First level can be objects (sections)
            for (const nestedKey in value) {
              expect(typeof value[nestedKey]).toBe('string');
            }
          }
        }
      };

      checkValues(en, 'English');
      checkValues(he, 'Hebrew');
    });
  });
});
