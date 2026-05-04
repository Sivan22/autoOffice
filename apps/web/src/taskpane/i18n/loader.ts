import type { LocaleId } from './registry.ts';
import type { TranslationDict } from './types.ts';

const cache = new Map<LocaleId, TranslationDict>();

export async function loadLocale(id: LocaleId): Promise<TranslationDict> {
  const cached = cache.get(id);
  if (cached) return cached;
  const mod = await import(`./locales/${id}.json`);
  const dict = (mod.default ?? mod) as TranslationDict;
  cache.set(id, dict);
  return dict;
}

/** Test helper. Not exported from `i18n/index.ts`. */
export function clearLoaderCache(): void {
  cache.clear();
}
