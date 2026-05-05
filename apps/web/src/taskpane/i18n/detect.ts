import { DEFAULT_LOCALE, isLocaleId, type LocaleId } from './registry.ts';

const HISTORICAL: Record<string, string> = { iw: 'he', in: 'id', ji: 'yi' };

/**
 * Lower-case, dash-normalize, then walk down subtags until a registered
 * locale matches. Returns null if nothing matches.
 */
export function normalizeLanguageTag(tag: string): LocaleId | null {
  if (!tag) return null;
  let t = tag.toLowerCase().replace(/_/g, '-');
  const head = t.split('-')[0];
  if (head in HISTORICAL) t = HISTORICAL[head] + t.slice(head.length);
  while (t.length > 0) {
    if (isLocaleId(t)) return t;
    const i = t.lastIndexOf('-');
    if (i === -1) break;
    t = t.slice(0, i);
  }
  return null;
}

export interface DetectInput {
  saved?: string | null;
}

export function detectLocale({ saved }: DetectInput): LocaleId {
  if (saved && isLocaleId(saved)) return saved;

  // Prefer the document/content language (e.g., Word document language) over
  // the Office UI language so a Hebrew document opens the pane in Hebrew even
  // when Office's chrome is English.
  try {
    const off = (globalThis as any).Office;
    const content = off?.context?.contentLanguage;
    if (typeof content === 'string') {
      const hit = normalizeLanguageTag(content);
      if (hit) return hit;
    }
    const display = off?.context?.displayLanguage;
    if (typeof display === 'string') {
      const hit = normalizeLanguageTag(display);
      if (hit) return hit;
    }
  } catch { /* fall through */ }

  try {
    const nav = (globalThis as any).navigator;
    const langs: string[] = nav?.languages ?? (nav?.language ? [nav.language] : []);
    for (const l of langs) {
      const hit = normalizeLanguageTag(l);
      if (hit) return hit;
    }
  } catch { /* fall through */ }

  return DEFAULT_LOCALE;
}
