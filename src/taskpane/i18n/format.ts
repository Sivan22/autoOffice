import type { LocaleId } from './registry.ts';

export type DateStyle = 'short' | 'medium' | 'long';

export interface PluralBranches {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface Formatters {
  formatDate(value: Date | number, style?: DateStyle): string;
  formatNumber(value: number, opts?: Intl.NumberFormatOptions): string;
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  formatList(items: string[]): string;
  formatPlural(count: number, branches: PluralBranches): string;
}

export function makeFormatters(locale: LocaleId): Formatters {
  const dateShort = new Intl.DateTimeFormat(locale, { dateStyle: 'short' });
  const dateMedium = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const dateLong = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const number = new Intl.NumberFormat(locale);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  const plural = new Intl.PluralRules(locale);

  return {
    formatDate(value, style = 'short') {
      const f = style === 'long' ? dateLong : style === 'medium' ? dateMedium : dateShort;
      return f.format(typeof value === 'number' ? new Date(value) : value);
    },
    formatNumber(value, opts) {
      return opts ? new Intl.NumberFormat(locale, opts).format(value) : number.format(value);
    },
    formatRelativeTime(value, unit) {
      return relative.format(value, unit);
    },
    formatList(items) {
      return list.format(items);
    },
    formatPlural(count, branches) {
      const cat = plural.select(count) as keyof PluralBranches;
      const tpl = branches[cat] ?? branches.other;
      return tpl.replace(/\{\{n\}\}/g, String(count));
    },
  };
}
