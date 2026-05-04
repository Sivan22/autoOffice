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
    const merged = SettingsSchema.parse({ ...this.get(), ...patch });
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(KEY, JSON.stringify(merged));
    return merged;
  }
}
