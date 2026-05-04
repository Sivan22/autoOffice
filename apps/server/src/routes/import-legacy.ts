import { Hono } from 'hono';
import {
  DEFAULT_SETTINGS,
  LegacyImportPayloadSchema,
  LegacyImportResultSchema,
} from '@autooffice/shared';
import type { SettingsRepo } from '../db/settings';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';

export function importLegacyRouter(deps: {
  settings: SettingsRepo;
  conversations: ConversationsRepo;
  messages: MessagesRepo;
}) {
  const r = new Hono();

  r.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = LegacyImportPayloadSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const payload = parsed.data;

    let importedSettings = false;
    let skippedReason: string | null = null;

    if (payload.settings) {
      const cur = deps.settings.get();
      const isDefault = JSON.stringify(cur) === JSON.stringify(DEFAULT_SETTINGS);
      if (isDefault) {
        deps.settings.update(payload.settings);
        importedSettings = true;
      } else {
        skippedReason = 'settings already exist';
      }
    }

    let importedConversationCount = 0;
    let importedMessageCount = 0;
    for (const lc of payload.conversations) {
      const id = deps.conversations.create({
        host: lc.host,
        title: lc.title ?? null,
      });
      const msgs = lc.messages.map((m) => ({
        id: m.id ?? `msg_legacy_${Math.random().toString(36).slice(2)}`,
        conversationId: id,
        role: m.role ?? 'user',
        parts: (m.parts ?? []) as unknown[],
        metadata: m.metadata ?? null,
      }));
      if (msgs.length > 0) deps.messages.replaceAll(id, msgs);
      importedConversationCount += 1;
      importedMessageCount += msgs.length;
    }

    return c.json(
      LegacyImportResultSchema.parse({
        importedSettings,
        importedConversationCount,
        importedMessageCount,
        skippedReason,
      }),
    );
  });

  return r;
}
