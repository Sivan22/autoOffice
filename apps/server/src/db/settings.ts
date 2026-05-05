import type { Database } from 'bun:sqlite';
import { DEFAULT_SETTINGS, type Settings, SettingsSchema } from '@autooffice/shared';

const KEY = 'global';

export class SettingsRepo {
  constructor(private readonly db: Database) {}

  get(): Settings {
    const row = this.db
      .query<{ value: string }, [string]>('SELECT value FROM settings WHERE key = ?')
      .get(KEY);
    if (!row) return DEFAULT_SETTINGS;
    return SettingsSchema.parse(JSON.parse(row.value));
  }

  update(patch: Partial<Settings>): Settings {
    // Drop undefined entries so they don't shadow existing values when spread,
    // which would otherwise re-apply Zod defaults on parse.
    const defined: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) defined[k] = v;
    }
    const merged = SettingsSchema.parse({ ...this.get(), ...defined });
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(KEY, JSON.stringify(merged));
    return merged;
  }
}
