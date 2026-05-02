import { Locale } from './types';
import { getLocaleInfo } from './locales';

/**
 * Service for managing layout direction and alignment based on locale
 */
export interface LayoutService {
  /**
   * Get text direction for locale
   * @param locale - The locale to get direction for
   * @returns 'ltr' for left-to-right languages, 'rtl' for right-to-left languages
   */
  getDirection(locale: Locale): 'ltr' | 'rtl';
  
  /**
   * Apply direction to document
   * @param direction - The direction to apply ('ltr' or 'rtl')
   */
  applyDirection(direction: 'ltr' | 'rtl'): void;
  
  /**
   * Get alignment for locale
   * @param locale - The locale to get alignment for
   * @returns 'left' for LTR languages, 'right' for RTL languages
   */
  getAlignment(locale: Locale): 'left' | 'right';
}

/**
 * Default implementation of LayoutService
 */
class DefaultLayoutService implements LayoutService {
  /**
   * Get text direction for locale
   */
  getDirection(locale: Locale): 'ltr' | 'rtl' {
    const localeInfo = getLocaleInfo(locale);
    return localeInfo.direction;
  }
  
  /**
   * Apply direction to document
   * Sets the dir attribute on the document root element
   */
  applyDirection(direction: 'ltr' | 'rtl'): void {
    const root = document.documentElement;
    root.setAttribute('dir', direction);
    
    // Also set the lang attribute based on direction for better accessibility
    // This helps screen readers and other assistive technologies
    if (direction === 'rtl') {
      root.setAttribute('lang', 'he');
    } else {
      root.setAttribute('lang', 'en');
    }
  }
  
  /**
   * Get alignment for locale
   * Returns the appropriate text alignment based on text direction
   */
  getAlignment(locale: Locale): 'left' | 'right' {
    const direction = this.getDirection(locale);
    return direction === 'rtl' ? 'right' : 'left';
  }
}

/**
 * Singleton instance of the layout service
 */
export const layoutService: LayoutService = new DefaultLayoutService();

/**
 * Get text direction for a locale
 * @param locale - The locale to get direction for
 * @returns 'ltr' or 'rtl'
 */
export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return layoutService.getDirection(locale);
}

/**
 * Apply direction to document
 * @param direction - The direction to apply
 */
export function applyDirection(direction: 'ltr' | 'rtl'): void {
  layoutService.applyDirection(direction);
}

/**
 * Get text alignment for a locale
 * @param locale - The locale to get alignment for
 * @returns 'left' or 'right'
 */
export function getAlignment(locale: Locale): 'left' | 'right' {
  return layoutService.getAlignment(locale);
}
