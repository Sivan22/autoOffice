import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, makeFreshConfig, type ServerConfig } from './config';

describe('config', () => {
  function withDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'aoffice-'));
    try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('returns null when config does not exist', () => {
    withDir((dir) => {
      expect(loadConfig(dir)).toBeNull();
    });
  });

  it('round-trips a config', () => {
    withDir((dir) => {
      const fresh: ServerConfig = makeFreshConfig({ port: 47318 });
      saveConfig(dir, fresh);
      const back = loadConfig(dir);
      expect(back).toEqual(fresh);
    });
  });

  it('makeFreshConfig generates a 64-char token', () => {
    const c = makeFreshConfig({ port: 47318 });
    expect(c.token).toMatch(/^[a-f0-9]{64}$/);
    expect(c.installId).toMatch(/^[a-f0-9]{32}$/);
  });
});
