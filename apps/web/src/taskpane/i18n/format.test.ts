import { describe, it, expect } from 'vitest';
import { makeFormatters } from './format.ts';

describe('formatters', () => {
  it('formatDate returns a non-empty locale-specific string', () => {
    const en = makeFormatters('en');
    const he = makeFormatters('he');
    const ts = Date.UTC(2026, 0, 15);
    expect(en.formatDate(ts, 'short')).toMatch(/\d/);
    expect(he.formatDate(ts, 'short')).toMatch(/\d/);
  });

  it('formatNumber uses locale-appropriate separators', () => {
    const en = makeFormatters('en');
    expect(en.formatNumber(1234.5)).toBe('1,234.5');
  });

  it('formatRelativeTime returns a string', () => {
    const en = makeFormatters('en');
    expect(en.formatRelativeTime(-2, 'minute')).toMatch(/2/);
  });

  it('formatList joins items with locale-appropriate conjunction', () => {
    const en = makeFormatters('en');
    expect(en.formatList(['A', 'B', 'C'])).toBe('A, B, and C');
  });

  it('formatPlural picks the matching branch by Intl.PluralRules', () => {
    const en = makeFormatters('en');
    expect(en.formatPlural(1, { one: '{{n}} file', other: '{{n}} files' }))
      .toBe('1 file');
    expect(en.formatPlural(2, { one: '{{n}} file', other: '{{n}} files' }))
      .toBe('2 files');
  });
});
