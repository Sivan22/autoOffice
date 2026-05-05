import * as z from 'zod';

export const SettingsSchema = z.object({
  locale: z.string().default('en'),
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
  locale: z.string().optional(),
  autoApprove: z.boolean().optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
  selectedProviderId: z.string().nullable().optional(),
  selectedModelId: z.string().nullable().optional(),
});

export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;
