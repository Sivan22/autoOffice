import * as z from 'zod';

export const HostSchema = z.enum(['word', 'excel', 'powerpoint']);
export type Host = z.infer<typeof HostSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  host: HostSchema,
  providerId: z.string().nullable(),
  modelId: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.unknown()),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.number().int(),
});
export type Message = z.infer<typeof MessageSchema>;
