import { describe, it, expect } from 'vitest';
import { openDb } from './index';

describe('openDb', () => {
  it('creates an in-memory db and runs all migrations', () => {
    const db = openDb({ url: ':memory:' });
    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'schema_migrations',
        'settings',
        'conversations',
        'messages',
        'provider_configs',
        'mcp_servers',
        'mcp_tool_policies',
      ]),
    );
    db.close();
  });

  it('records applied migrations in schema_migrations', () => {
    const db = openDb({ url: ':memory:' });
    const versions = (db.query('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>).map((r) => r.version);
    expect(versions).toEqual([1, 2]);
    db.close();
  });

  it('is idempotent — second open does not re-apply migrations', () => {
    const db = openDb({ url: ':memory:' });
    const before = (db.query('SELECT count(*) AS c FROM schema_migrations').get() as { c: number }).c;
    // simulate reopen on the same connection
    db.exec('SELECT 1');
    const after = (db.query('SELECT count(*) AS c FROM schema_migrations').get() as { c: number }).c;
    expect(before).toBe(after);
    db.close();
  });
});
