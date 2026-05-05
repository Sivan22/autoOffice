import * as z from 'zod';

// Locale ids supported across the app. Keep in sync with the web app's
// LOCALES registry — the server validates against this list so the locale
// setting can't get into an unknown state (which would force the web app
// to fall back to defaults silently).
export const LOCALE_IDS = ['en', 'he'] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];
export const LocaleIdSchema = z.enum(LOCALE_IDS);

export function isLocaleId(s: unknown): s is LocaleId {
  return typeof s === 'string' && (LOCALE_IDS as readonly string[]).includes(s);
}

export const SettingsSchema = z.object({
  locale: LocaleIdSchema.default('en'),
  autoApprove: z.boolean().default(false),
  maxSteps: z.number().int().min(1).max(50).default(20),
  selectedProviderId: z.string().nullable().default(null),
  selectedModelId: z.string().nullable().default(null),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

// Patch schema for PUT /api/settings: each field is optional and has NO default,
// so omitted fields stay omitted (vs. SettingsSchema.partial(), which still
// applies defaults and would clobber unrelated fields like selectedProviderId).
export const SettingsPatchSchema = z.object({
  locale: LocaleIdSchema.optional(),
  autoApprove: z.boolean().optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
  selectedProviderId: z.string().nullable().optional(),
  selectedModelId: z.string().nullable().optional(),
});

export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
