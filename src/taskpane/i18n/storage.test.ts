import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadLanguage, saveLanguage, detectLanguage } from './storage';
import type { Locale } from './types';

describe('Language Storage Service', () => {
  describe('detectLanguage', () => {
    beforeEach(() => {
      // Clear any Office mock
      (globalThis as any).Office = undefined;
    });

    it('should detect English from browser language', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
      
      expect(detectLanguage()).toBe('en');
    });

    it('should detect Hebrew from browser language', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'he-IL',
        configurable: true,
      });
      
      expect(detectLanguage()).toBe('he');
    });

    it('should detect Hebrew from old "iw" language code', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'iw-IL',
        configurable: true,
      });
      
      expect(detectLanguage()).toBe('he');
    });

    it('should default to English for unsupported languages', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      });
      
      expect(detectLanguage()).toBe('en');
    });

    it('should detect from Office displayLanguage when available', () => {
      (globalThis as any).Office = {
        context: {
          displayLanguage: 'he-IL',
        },
      };
      
      expect(detectLanguage()).toBe('he');
    });

    it('should prefer Office language over browser language', () => {
      (globalThis as any).Office = {
        context: {
          displayLanguage: 'he-IL',
        },
      };
      
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      });
      
      expect(detectLanguage()).toBe('he');
    });

    it('should handle missing navigator gracefully', () => {
      const originalNavigator = globalThis.navigator;
      (globalThis as any).navigator = undefined;
      
      expect(detectLanguage()).toBe('en');
      
      (globalThis as any).navigator = originalNavigator;
    });
  });

  describe('localStorage storage', () => {
    beforeEach(() => {
      localStorage.clear();
      (globalThis as any).Office = undefined;
    });

    it('should save language to localStorage', () => {
      saveLanguage('he');
      expect(localStorage.getItem('autooffice_language')).toBe('he');
    });

    it('should load language from localStorage', () => {
      localStorage.setItem('autooffice_language', 'he');
      expect(loadLanguage()).toBe('he');
    });

    it('should return null when no language is saved', () => {
      expect(loadLanguage()).toBeNull();
    });

    it('should return null for invalid locale in storage', () => {
      localStorage.setItem('autooffice_language', 'invalid');
      expect(loadLanguage()).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      // Should not throw
      expect(() => saveLanguage('en')).not.toThrow();
      
      setItemSpy.mockRestore();
    });

    it('should handle localStorage read errors gracefully', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });
      
      expect(loadLanguage()).toBeNull();
      
      getItemSpy.mockRestore();
    });
  });

  describe('Office roamingSettings storage', () => {
    let mockRoamingSettings: any;

    beforeEach(() => {
      localStorage.clear();
      
      mockRoamingSettings = {
        get: vi.fn(),
        set: vi.fn(),
        saveAsync: vi.fn((callback) => {
          callback({ status: 'succeeded' });
        }),
      };

      (globalThis as any).Office = {
        context: {
          roamingSettings: mockRoamingSettings,
        },
        AsyncResultStatus: {
          Succeeded: 'succeeded',
          Failed: 'failed',
        },
      };
    });

    afterEach(() => {
      (globalThis as any).Office = undefined;
    });

    it('should save language to roamingSettings', () => {
      saveLanguage('he');
      
      expect(mockRoamingSettings.set).toHaveBeenCalledWith('autooffice_language', 'he');
      expect(mockRoamingSettings.saveAsync).toHaveBeenCalled();
    });

    it('should load language from roamingSettings', () => {
      mockRoamingSettings.get.mockReturnValue('he');
      
      expect(loadLanguage()).toBe('he');
      expect(mockRoamingSettings.get).toHaveBeenCalledWith('autooffice_language');
    });

    it('should return null when no language in roamingSettings', () => {
      mockRoamingSettings.get.mockReturnValue(null);
      
      expect(loadLanguage()).toBeNull();
    });

    it('should return null for invalid locale in roamingSettings', () => {
      mockRoamingSettings.get.mockReturnValue('invalid');
      
      expect(loadLanguage()).toBeNull();
    });

    it('should handle roamingSettings save errors gracefully', () => {
      mockRoamingSettings.saveAsync.mockImplementation((callback: any) => {
        callback({
          status: 'failed',
          error: { message: 'Network error' },
        });
      });
      
      // Should not throw
      expect(() => saveLanguage('en')).not.toThrow();
    });

    it('should handle roamingSettings read errors gracefully', () => {
      mockRoamingSettings.get.mockImplementation(() => {
        throw new Error('Access denied');
      });
      
      expect(loadLanguage()).toBeNull();
    });

    it('should prefer roamingSettings over localStorage', () => {
      localStorage.setItem('autooffice_language', 'en');
      mockRoamingSettings.get.mockReturnValue('he');
      
      expect(loadLanguage()).toBe('he');
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      localStorage.clear();
      (globalThis as any).Office = undefined;
    });

    it('should save and load the same language', () => {
      saveLanguage('he');
      expect(loadLanguage()).toBe('he');
      
      saveLanguage('en');
      expect(loadLanguage()).toBe('en');
    });

    it('should use detected language when no saved preference', () => {
      Object.defineProperty(navigator, 'language', {
        value: 'he-IL',
        configurable: true,
      });
      
      expect(loadLanguage()).toBeNull();
      expect(detectLanguage()).toBe('he');
    });
  });
});
