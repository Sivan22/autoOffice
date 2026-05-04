import { Hono } from 'hono';
import * as z from 'zod';
import { HostSchema } from '@autooffice/shared';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';

const CreateBody = z.object({
  host: HostSchema,
  title: z.string().nullish(),
  providerId: z.string().nullish(),
  modelId: z.string().nullish(),
});

const PatchBody = z.object({ title: z.string().min(1).max(200) });

export function conversationsRouter(convs: ConversationsRepo, msgs: MessagesRepo) {
  const r = new Hono();

  r.get('/', (c) => c.json(convs.list()));

  r.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = CreateBody.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const id = convs.create({
      host: parsed.data.host,
      title: parsed.data.title ?? null,
      providerId: parsed.data.providerId ?? null,
      modelId: parsed.data.modelId ?? null,
    });
    return c.json({ id }, 201);
  });

  r.get('/:id', (c) => {
    const id = c.req.param('id');
    const conversation = convs.get(id);
    if (!conversation) return c.json({ error: 'not found' }, 404);
    const messages = msgs.listByConversation(id);
    return c.json({ conversation, messages });
  });

  r.patch('/:id', async (c) => {
    const id = c.req.param('id');
    if (!convs.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    convs.rename(id, parsed.data.title);
    return c.json(convs.get(id));
  });

  r.delete('/:id', (c) => {
    const id = c.req.param('id');
    convs.delete(id);
    return c.body(null, 204);
  });

  return r;
}
