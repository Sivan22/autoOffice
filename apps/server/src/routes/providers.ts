import { Hono } from 'hono';
import {
  CreateProviderInputSchema,
  UpdateProviderInputSchema,
} from '@autooffice/shared';
import type { ProvidersRepo } from '../db/providers';
import type { ProviderRegistry } from '../providers';

export function providersRouter(repo: ProvidersRepo, registry: ProviderRegistry) {
  const r = new Hono();

  r.get('/', async (c) => {
    const list = repo.list();
    const enriched = await Promise.all(list.map(async (p) => ({ ...p, status: await registry.getStatus(p.id) })));
    return c.json(enriched);
  });

  r.post('/', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = CreateProviderInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    try {
      const id = repo.create(parsed.data);
      return c.json({ id }, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  r.put('/:id', async (c) => {
    const id = c.req.param('id');
    if (!repo.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = UpdateProviderInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    try {
      repo.update(id, parsed.data);
      return c.json(repo.get(id));
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  r.delete('/:id', (c) => {
    const id = c.req.param('id');
    repo.delete(id);
    return c.body(null, 204);
  });

  r.post('/:id/test', async (c) => {
    const id = c.req.param('id');
    if (!repo.get(id)) return c.json({ error: 'not found' }, 404);
    const status = await registry.getStatus(id);
    return c.json({ status });
  });

  return r;
}
