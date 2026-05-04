import * as z from 'zod';

export const McpTransportSchema = z.enum(['stdio', 'sse', 'streamable-http']);
export type McpTransport = z.infer<typeof McpTransportSchema>;

export const McpPolicySchema = z.enum(['allow', 'ask', 'deny']);
export type McpPolicy = z.infer<typeof McpPolicySchema>;

export const McpStatusSchema = z.enum(['connecting', 'connected', 'disconnected', 'error', 'disabled']);
export type McpStatus = z.infer<typeof McpStatusSchema>;

const StdioFields = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().nullish(),
  env: z.record(z.string(), z.string()).default({}),
});

const HttpFields = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
});

export const McpServerInputSchema = z.discriminatedUnion('transport', [
  StdioFields.extend({ transport: z.literal('stdio') }),
  HttpFields.extend({ transport: z.literal('sse') }),
  HttpFields.extend({ transport: z.literal('streamable-http') }),
]);

export const CreateMcpServerInputSchema = z.object({
  label: z.string().min(1).max(80),
  timeoutSeconds: z.number().int().min(1).max(600).default(60),
  defaultPolicy: McpPolicySchema.default('ask'),
  disabled: z.boolean().default(false),
  spec: McpServerInputSchema,
});
export type CreateMcpServerInput = z.infer<typeof CreateMcpServerInputSchema>;

export const UpdateMcpServerInputSchema = CreateMcpServerInputSchema.partial();
export type UpdateMcpServerInput = z.infer<typeof UpdateMcpServerInputSchema>;

export const McpToolDescriptorSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  inputSchema: z.unknown().nullish(),
  policy: McpPolicySchema,
});
export type McpToolDescriptor = z.infer<typeof McpToolDescriptorSchema>;

export const McpServerViewSchema = z.object({
  id: z.string(),
  label: z.string(),
  transport: McpTransportSchema,
  command: z.string().nullable(),
  args: z.array(z.string()),
  cwd: z.string().nullable(),
  env: z.record(z.string(), z.string()),
  url: z.string().nullable(),
  headers: z.record(z.string(), z.string()),
  timeoutSeconds: z.number().int(),
  defaultPolicy: McpPolicySchema,
  disabled: z.boolean(),
  status: McpStatusSchema,
  errorMessage: z.string().nullable(),
  tools: z.array(McpToolDescriptorSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type McpServerView = z.infer<typeof McpServerViewSchema>;
