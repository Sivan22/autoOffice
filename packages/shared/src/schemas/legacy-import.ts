import * as z from 'zod';
import { SettingsSchema } from './settings';
import { HostSchema, MessageSchema } from './conversation';

export const LegacyConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  host: HostSchema,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  messages: z.array(MessageSchema.partial({ conversationId: true })).default([]),
});

export const LegacyImportPayloadSchema = z.object({
  settings: SettingsSchema.partial().nullish(),
  conversations: z.array(LegacyConversationSchema).default([]),
  // Provider / MCP not migrated automatically: API keys aren't recoverable across the
  // crypto boundary, and CLI-bridge providers have to be re-added with their CLI auth.
});
export type LegacyImportPayload = z.infer<typeof LegacyImportPayloadSchema>;

export const LegacyImportResultSchema = z.object({
  importedSettings: z.boolean(),
  importedConversationCount: z.number().int(),
  importedMessageCount: z.number().int(),
  skippedReason: z.string().nullable(),
});
export type LegacyImportResult = z.infer<typeof LegacyImportResultSchema>;
