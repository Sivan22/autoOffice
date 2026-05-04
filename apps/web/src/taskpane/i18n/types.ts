export interface LocaleMeta {
  /** English-language name, e.g. "Hebrew". */
  name: string;
  /** Self-name written in the locale itself, e.g. "עברית". */
  nativeName: string;
  /** Layout direction. */
  direction: 'ltr' | 'rtl';
  /** Locale id to fall back to for missing keys, or null for the root (en). */
  fallback: string | null;
}

/** Nested string dictionary loaded from a locale JSON file. */
export type TranslationDict = { [key: string]: string | TranslationDict };

/** Parameters interpolated into `{{name}}` placeholders inside a translation. */
export type TranslationParams = Record<string, string | number>;
