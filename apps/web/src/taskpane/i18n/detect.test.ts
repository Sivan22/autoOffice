import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectLocale, normalizeLanguageTag } from './detect.ts';

describe('normalizeLanguageTag', () => {
  it('resolves exact matches', () => {
    expect(normalizeLanguageTag('en')).toBe('en');
    expect(normalizeLanguageTag('he')).toBe('he');
  });

  it('lowercases and dashifies', () => {
    expect(normalizeLanguageTag('EN_US')).toBe('en');
    expect(normalizeLanguageTag('HE-IL')).toBe('he');
  });

  it('strips trailing subtags until a registry hit', () => {
    expect(normalizeLanguageTag('en-GB')).toBe('en');
    expect(normalizeLanguageTag('he-Hebr-IL')).toBe('he');
  });

  it('maps historical codes', () => {
    expect(normalizeLanguageTag('iw')).toBe('he');
    expect(normalizeLanguageTag('iw-IL')).toBe('he');
  });

  it('returns null for unsupported tags', () => {
    expect(normalizeLanguageTag('zz')).toBeNull();
    expect(normalizeLanguageTag('')).toBeNull();
  });
});

describe('detectLocale', () => {
  beforeEach(() => {
    // Each test stubs what it needs; default is "no Office, no preference".
    vi.unstubAllGlobals();
  });

  it('prefers a saved locale that is still in the registry', () => {
    expect(detectLocale({ saved: 'he' })).toBe('he');
  });

  it('ignores a saved locale that is no longer registered', () => {
    expect(detectLocale({ saved: 'xx' as any })).toBe('en');
  });

  it('prefers Office.context.contentLanguage (document language) over displayLanguage', () => {
    vi.stubGlobal('Office', {
      context: { contentLanguage: 'he-IL', displayLanguage: 'en-US' },
    });
    expect(detectLocale({})).toBe('he');
  });

  it('falls back to Office.context.displayLanguage when contentLanguage is missing', () => {
    vi.stubGlobal('Office', { context: { displayLanguage: 'he-IL' } });
    expect(detectLocale({})).toBe('he');
  });

  it('falls back to navigator.languages', () => {
    vi.stubGlobal('Office', undefined);
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'he-IL', 'en-US'] });
    expect(detectLocale({})).toBe('he'); // first registry hit wins
  });

  it('falls back to DEFAULT_LOCALE', () => {
    vi.stubGlobal('Office', undefined);
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    expect(detectLocale({})).toBe('en');
  });
});
