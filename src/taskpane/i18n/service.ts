import type { TranslationDict, TranslationParams } from './types.ts';
import { DEFAULT_LOCALE, LOCALES, isLocaleId, type LocaleId } from './registry.ts';
import { loadLocale } from './loader.ts';
import type { TranslationKey } from './keys.generated.ts';

type Listener = (locale: LocaleId) => void;

function getNested(dict: TranslationDict | undefined, path: string): string | undefined {
  if (!dict) return undefined;
  const parts = path.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : m,
  );
}

export class TranslationService {
  private locale: LocaleId = DEFAULT_LOCALE;
  private active: TranslationDict | undefined;
  private dicts = new Map<LocaleId, TranslationDict>();
  private listeners = new Set<Listener>();

  getLocale(): LocaleId {
    return this.locale;
  }

  /**
   * Load `id` (and its fallback chain) into memory and make it active.
   * Safe to call repeatedly; cached after first load.
   */
  async setLocale(id: LocaleId): Promise<void> {
    if (!isLocaleId(id)) throw new Error(`Unknown locale: ${id}`);

    // Walk fallback chain so missing keys can resolve synchronously in t().
    const chain: LocaleId[] = [];
    let cursor: LocaleId | null = id;
    while (cursor !== null) {
      chain.push(cursor);
      cursor = LOCALES[cursor].fallback as LocaleId | null;
    }
    await Promise.all(
      chain.map(async c => {
        if (!this.dicts.has(c)) this.dicts.set(c, await loadLocale(c));
      }),
    );

    this.locale = id;
    this.active = this.dicts.get(id);
    for (const l of this.listeners) l(id);
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    let cursor: LocaleId | null = this.locale;
    while (cursor !== null) {
      const dict = cursor === this.locale ? this.active : this.dicts.get(cursor);
      const hit = getNested(dict, key);
      if (hit !== undefined) return interpolate(hit, params);
      cursor = LOCALES[cursor].fallback as LocaleId | null;
    }
    return key;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const translationService = new TranslationService();
