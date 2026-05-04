import * as z from 'zod';

export const ProviderKindSchema = z.enum([
  'anthropic',
  'openai',
  'google',
  'groq',
  'xai',
  'deepseek',
  'openrouter',
  'ollama',
  'openai-compatible',
  'vercel-gateway',
  'claude-code',
  'gemini-cli',
  'opencode',
]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

export const CLI_BRIDGE_KINDS: ReadonlyArray<ProviderKind> = ['claude-code', 'gemini-cli', 'opencode'];

export function isCliBridge(kind: ProviderKind): boolean {
  return CLI_BRIDGE_KINDS.includes(kind);
}

export const ProviderConfigSchema = z.object({
  id: z.string(),
  kind: ProviderKindSchema,
  label: z.string().min(1).max(80),
  config: z.record(z.string(), z.unknown()).default({}),  // baseUrl, model defaults, etc.
  hasKey: z.boolean(),                                     // server hides ciphertext from clients
  status: z.enum(['ready', 'needs-key', 'cli-not-found', 'cli-not-authed', 'unknown']).default('unknown'),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const CreateProviderInputSchema = z.object({
  kind: ProviderKindSchema,
  label: z.string().min(1).max(80),
  config: z.record(z.string(), z.unknown()).optional(),
  apiKey: z.string().min(1).optional(),                    // omitted for CLI bridges
});
export type CreateProviderInput = z.infer<typeof CreateProviderInputSchema>;

export const UpdateProviderInputSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  apiKey: z.string().min(1).optional(),                    // setting null/undefined keeps existing key
});
export type UpdateProviderInput = z.infer<typeof UpdateProviderInputSchema>;
