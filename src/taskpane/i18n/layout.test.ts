import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { layoutService, getDirection, applyDirection, getAlignment } from './layout';
import type { Locale } from './types';

describe('Layout Service', () => {
  describe('LayoutService.getDirection', () => {
    it('should return "ltr" for English locale', () => {
      const direction = layoutService.getDirection('en');
      expect(direction).toBe('ltr');
    });

    it('should return "rtl" for Hebrew locale', () => {
      const direction = layoutService.getDirection('he');
      expect(direction).toBe('rtl');
    });

    it('should return consistent results for the same locale', () => {
      const direction1 = layoutService.getDirection('en');
      const direction2 = layoutService.getDirection('en');
      expect(direction1).toBe(direction2);
    });
  });

  describe('LayoutService.applyDirection', () => {
    let originalDir: string | null;
    let originalLang: string | null;

    beforeEach(() => {
      // Save original attributes
      originalDir = document.documentElement.getAttribute('dir');
      originalLang = document.documentElement.getAttribute('lang');
    });

    afterEach(() => {
      // Restore original attributes
      if (originalDir !== null) {
        document.documentElement.setAttribute('dir', originalDir);
      } else {
        document.documentElement.removeAttribute('dir');
      }
      
      if (originalLang !== null) {
        document.documentElement.setAttribute('lang', originalLang);
      } else {
        document.documentElement.removeAttribute('lang');
      }
    });

    it('should set dir attribute to "ltr" on document root', () => {
      layoutService.applyDirection('ltr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('should set dir attribute to "rtl" on document root', () => {
      layoutService.applyDirection('rtl');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('should set lang attribute to "en" when applying ltr', () => {
      layoutService.applyDirection('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('should set lang attribute to "he" when applying rtl', () => {
      layoutService.applyDirection('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('he');
    });

    it('should update dir attribute when called multiple times', () => {
      layoutService.applyDirection('ltr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      
      layoutService.applyDirection('rtl');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      
      layoutService.applyDirection('ltr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('should update lang attribute when called multiple times', () => {
      layoutService.applyDirection('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
      
      layoutService.applyDirection('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('he');
    });
  });

  describe('LayoutService.getAlignment', () => {
    it('should return "left" for English locale', () => {
      const alignment = layoutService.getAlignment('en');
      expect(alignment).toBe('left');
    });

    it('should return "right" for Hebrew locale', () => {
      const alignment = layoutService.getAlignment('he');
      expect(alignment).toBe('right');
    });

    it('should return alignment consistent with direction', () => {
      const locales: Locale[] = ['en', 'he'];
      
      locales.forEach((locale) => {
        const direction = layoutService.getDirection(locale);
        const alignment = layoutService.getAlignment(locale);
        
        if (direction === 'ltr') {
          expect(alignment).toBe('left');
        } else {
          expect(alignment).toBe('right');
        }
      });
    });
  });

  describe('Exported helper functions', () => {
    describe('getDirection', () => {
      it('should return "ltr" for English', () => {
        expect(getDirection('en')).toBe('ltr');
      });

      it('should return "rtl" for Hebrew', () => {
        expect(getDirection('he')).toBe('rtl');
      });

      it('should delegate to layoutService', () => {
        const spy = vi.spyOn(layoutService, 'getDirection');
        getDirection('en');
        expect(spy).toHaveBeenCalledWith('en');
        spy.mockRestore();
      });
    });

    describe('applyDirection', () => {
      let originalDir: string | null;
      let originalLang: string | null;

      beforeEach(() => {
        originalDir = document.documentElement.getAttribute('dir');
        originalLang = document.documentElement.getAttribute('lang');
      });

      afterEach(() => {
        if (originalDir !== null) {
          document.documentElement.setAttribute('dir', originalDir);
        } else {
          document.documentElement.removeAttribute('dir');
        }
        
        if (originalLang !== null) {
          document.documentElement.setAttribute('lang', originalLang);
        } else {
          document.documentElement.removeAttribute('lang');
        }
      });

      it('should apply ltr direction', () => {
        applyDirection('ltr');
        expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      });

      it('should apply rtl direction', () => {
        applyDirection('rtl');
        expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      });

      it('should delegate to layoutService', () => {
        const spy = vi.spyOn(layoutService, 'applyDirection');
        applyDirection('ltr');
        expect(spy).toHaveBeenCalledWith('ltr');
        spy.mockRestore();
      });
    });

    describe('getAlignment', () => {
      it('should return "left" for English', () => {
        expect(getAlignment('en')).toBe('left');
      });

      it('should return "right" for Hebrew', () => {
        expect(getAlignment('he')).toBe('right');
      });

      it('should delegate to layoutService', () => {
        const spy = vi.spyOn(layoutService, 'getAlignment');
        getAlignment('en');
        expect(spy).toHaveBeenCalledWith('en');
        spy.mockRestore();
      });
    });
  });

  describe('Integration tests', () => {
    let originalDir: string | null;
    let originalLang: string | null;

    beforeEach(() => {
      originalDir = document.documentElement.getAttribute('dir');
      originalLang = document.documentElement.getAttribute('lang');
    });

    afterEach(() => {
      if (originalDir !== null) {
        document.documentElement.setAttribute('dir', originalDir);
      } else {
        document.documentElement.removeAttribute('dir');
      }
      
      if (originalLang !== null) {
        document.documentElement.setAttribute('lang', originalLang);
      } else {
        document.documentElement.removeAttribute('lang');
      }
    });

    it('should apply correct direction and alignment for English', () => {
      const locale: Locale = 'en';
      const direction = getDirection(locale);
      const alignment = getAlignment(locale);
      
      expect(direction).toBe('ltr');
      expect(alignment).toBe('left');
      
      applyDirection(direction);
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('should apply correct direction and alignment for Hebrew', () => {
      const locale: Locale = 'he';
      const direction = getDirection(locale);
      const alignment = getAlignment(locale);
      
      expect(direction).toBe('rtl');
      expect(alignment).toBe('right');
      
      applyDirection(direction);
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('he');
    });

    it('should handle switching between locales', () => {
      // Start with English
      let direction = getDirection('en');
      applyDirection(direction);
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
      
      // Switch to Hebrew
      direction = getDirection('he');
      applyDirection(direction);
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('he');
      
      // Switch back to English
      direction = getDirection('en');
      applyDirection(direction);
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid direction changes', () => {
      const directions: Array<'ltr' | 'rtl'> = ['ltr', 'rtl', 'ltr', 'rtl', 'ltr'];
      
      directions.forEach((direction) => {
        applyDirection(direction);
        expect(document.documentElement.getAttribute('dir')).toBe(direction);
      });
    });

    it('should maintain consistency between getDirection and getAlignment', () => {
      const locales: Locale[] = ['en', 'he'];
      
      locales.forEach((locale) => {
        const direction = getDirection(locale);
        const alignment = getAlignment(locale);
        
        // Verify the relationship between direction and alignment
        if (direction === 'ltr') {
          expect(alignment).toBe('left');
        } else if (direction === 'rtl') {
          expect(alignment).toBe('right');
        }
      });
    });
  });
});
