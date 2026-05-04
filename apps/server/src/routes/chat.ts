import { Hono } from 'hono';
import * as z from 'zod';
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  createIdGenerator,
} from 'ai';
import type { LanguageModel } from 'ai';
import { HostSchema, type Host } from '@autooffice/shared';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';
import type { ProviderRegistry } from '../providers';
import type { McpHub } from '../mcp/hub';
import { sweepOrphans } from '../chat/orphan-sweep';
import { systemPromptForHost } from '../chat/system-prompt';
import { assembleTools } from '../tools';

const Body = z.object({
  id: z.string(),
  host: HostSchema,
  providerId: z.string(),
  modelId: z.string(),
  trigger: z.enum(['submit-user-message', 'regenerate-assistant-message']),
  message: z.any().optional(),
  messageId: z.string().optional(),
});

export type ChatDeps = {
  conversations: ConversationsRepo;
  messages: MessagesRepo;
  registry: ProviderRegistry;
  hub: McpHub;
  modelOverride?: (providerId: string, modelId: string) => LanguageModel;
};

export function chatRouter(deps: ChatDeps) {
  const r = new Hono();

  r.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = Body.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const { id, host, providerId, modelId, trigger, message, messageId } = parsed.data;

    const conv = deps.conversations.get(id);
    if (!conv) return c.json({ error: 'not found' }, 404);

    let model: LanguageModel;
    try {
      const resolved = deps.modelOverride
        ? deps.modelOverride(providerId, modelId)
        : await deps.registry.resolve(providerId, modelId);
      if (!resolved) return c.json({ error: 'provider not found' }, 400);
      model = resolved;
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }

    // Pull current history; append new user message OR truncate to before regenerated message.
    const history = deps.messages.listByConversation(id);
    type Merged = {
      id: string;
      role: string;
      parts: unknown[];
      metadata: Record<string, unknown> | null;
      conversationId: string;
    };
    let merged: Merged[];
    if (trigger === 'submit-user-message' && message) {
      merged = [
        ...history,
        {
          id: message.id,
          role: message.role ?? 'user',
          parts: message.parts ?? [],
          metadata: message.metadata ?? null,
          conversationId: id,
        },
      ];
    } else if (trigger === 'regenerate-assistant-message' && messageId) {
      const idx = history.findIndex((m) => m.id === messageId);
      merged = idx >= 0 ? history.slice(0, idx) : history;
    } else {
      return c.json({ error: 'invalid trigger payload' }, 400);
    }

    const swept = sweepOrphans(merged as any) as typeof merged;
    const mcpTools = deps.hub.toolsForChat();
    const tools = assembleTools({ host: host as Host, mcpTools });

    const result = streamText({
      model,
      system: systemPromptForHost(host as Host),
      messages: await convertToModelMessages(swept as any),
      tools,
      stopWhen: stepCountIs(20),
    });

    result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: swept as any,
      generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
      onFinish: ({ messages: finalMessages }) => {
        deps.messages.replaceAll(
          id,
          (finalMessages as any).map((m: any) => ({
            id: m.id,
            conversationId: id,
            role: m.role,
            parts: m.parts ?? [],
            metadata: m.metadata ?? null,
          })),
        );
        deps.conversations.touch(id);
      },
    });
  });

  return r;
}
