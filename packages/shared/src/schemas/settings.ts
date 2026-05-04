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
