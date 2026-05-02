import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadSettings, saveSettings, type AppSettings } from './settings';

describe('Settings Store', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Mock Office environment
    vi.stubGlobal('Office', undefined);
  });

  describe('loadSettings', () => {
    it('should return default settings when no saved settings exist', () => {
      const settings = loadSettings();
      
      expect(settings.language).toBe('en');
      expect(settings.selectedProviderId).toBe('');
      expect(settings.autoApprove).toBe(false);
      expect(settings.maxRetries).toBe(3);
      expect(settings.executionTimeout).toBe(30000);
    });

    it('should load settings with language field from localStorage', () => {
      const savedSettings: Partial<AppSettings> = {
        language: 'he',
        selectedProviderId: 'anthropic',
        selectedModel: 'claude-3-5-sonnet-20241022',
        autoApprove: true,
      };
      
      localStorage.setItem('autooffice_settings', JSON.stringify(savedSettings));
      
      const settings = loadSettings();
      
      expect(settings.language).toBe('he');
      expect(settings.selectedProviderId).toBe('anthropic');
      expect(settings.selectedModel).toBe('claude-3-5-sonnet-20241022');
      expect(settings.autoApprove).toBe(true);
    });

    it('should merge saved settings with defaults', () => {
      const savedSettings: Partial<AppSettings> = {
        language: 'he',
        selectedProviderId: 'openai',
      };
      
      localStorage.setItem('autooffice_settings', JSON.stringify(savedSettings));
      
      const settings = loadSettings();
      
      expect(settings.language).toBe('he');
      expect(settings.selectedProviderId).toBe('openai');
      expect(settings.maxRetries).toBe(3); // Default value
      expect(settings.executionTimeout).toBe(30000); // Default value
    });

    it('should default to "en" when language field is missing', () => {
      const savedSettings = {
        selectedProviderId: 'anthropic',
        autoApprove: true,
      };
      
      localStorage.setItem('autooffice_settings', JSON.stringify(savedSettings));
      
      const settings = loadSettings();
      
      expect(settings.language).toBe('en');
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('autooffice_settings', 'invalid json');
      
      const settings = loadSettings();
      
      expect(settings.language).toBe('en');
      expect(settings).toMatchObject({
        selectedProviderId: '',
        autoApprove: false,
      });
    });
  });

  describe('saveSettings', () => {
    it('should save settings with language field to localStorage', () => {
      const settings: AppSettings = {
        language: 'he',
        selectedProviderId: 'anthropic',
        selectedModel: 'claude-3-5-sonnet-20241022',
        providers: [],
        autoApprove: true,
        mcpServers: [],
        maxRetries: 3,
        executionTimeout: 30000,
      };
      
      saveSettings(settings);
      
      const saved = localStorage.getItem('autooffice_settings');
      expect(saved).toBeTruthy();
      
      const parsed = JSON.parse(saved!);
      expect(parsed.language).toBe('he');
      expect(parsed.selectedProviderId).toBe('anthropic');
      expect(parsed.autoApprove).toBe(true);
    });

    it('should persist language changes', () => {
      const initialSettings = loadSettings();
      expect(initialSettings.language).toBe('en');
      
      const updatedSettings: AppSettings = {
        ...initialSettings,
        language: 'he',
      };
      
      saveSettings(updatedSettings);
      
      const reloadedSettings = loadSettings();
      expect(reloadedSettings.language).toBe('he');
    });

    it('should handle save errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const settings = loadSettings();
      
      // Should not throw
      expect(() => saveSettings(settings)).not.toThrow();
      
      // Restore original implementation
      localStorage.setItem = originalSetItem;
    });
  });

  describe('default language value', () => {
    it('should have "en" as default language', () => {
      const settings = loadSettings();
      expect(settings.language).toBe('en');
    });

    it('should preserve language field through save/load cycle', () => {
      const settings = loadSettings();
      settings.language = 'he';
      
      saveSettings(settings);
      
      const reloaded = loadSettings();
      expect(reloaded.language).toBe('he');
    });
  });
});
