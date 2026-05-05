import { Hono } from 'hono';
import { SettingsPatchSchema, type Settings } from '@autooffice/shared';
import type { SettingsRepo } from '../db/settings';

export function settingsRouter(repo: SettingsRepo) {
  const r = new Hono();

  r.get('/', (c) => c.json(repo.get()));

  r.put('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    const parsed = SettingsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    }
    const next: Settings = repo.update(parsed.data);
    return c.json(next);
  });

  return r;
}
