import type { LocaleMeta } from './types.ts';

export const LOCALES = {
  en: { name: 'English', nativeName: 'English', direction: 'ltr', fallback: null },
  he: { name: 'Hebrew',  nativeName: 'עברית',   direction: 'rtl', fallback: 'en' },
} as const satisfies Record<string, LocaleMeta>;

export type LocaleId = keyof typeof LOCALES;
export const DEFAULT_LOCALE: LocaleId = 'en';

export function isLocaleId(s: string): s is LocaleId {
  return Object.prototype.hasOwnProperty.call(LOCALES, s);
}

export function getLocaleMeta(id: LocaleId): LocaleMeta {
  return LOCALES[id];
}

export function availableLocales(): Array<{ id: LocaleId } & LocaleMeta> {
  return (Object.keys(LOCALES) as LocaleId[]).map(id => ({ id, ...LOCALES[id] }));
}
