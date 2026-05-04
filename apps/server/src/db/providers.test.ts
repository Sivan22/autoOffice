import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { ProvidersRepo } from './providers';

const isWin = process.platform === 'win32';

describe('ProvidersRepo', () => {
  let repo: ProvidersRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new ProvidersRepo(db);
  });

  it('creates a provider without a key (CLI bridge)', () => {
    const id = repo.create({ kind: 'claude-code', label: 'My Claude Code' });
    const got = repo.get(id);
    expect(got).toMatchObject({ kind: 'claude-code', label: 'My Claude Code', hasKey: false });
  });

  it.runIf(isWin)('encrypts API keys via DPAPI on Windows', () => {
    const id = repo.create({ kind: 'anthropic', label: 'Anthropic', apiKey: 'sk-test' });
    expect(repo.get(id)!.hasKey).toBe(true);
    expect(repo.getDecryptedKey(id)).toBe('sk-test');
  });

  it.skipIf(isWin)('refuses to store an apiKey on non-Windows (DPAPI unavailable)', () => {
    expect(() => repo.create({ kind: 'anthropic', label: 'Anthropic', apiKey: 'sk-test' })).toThrow(/Windows/);
  });

  it('list returns all providers', () => {
    repo.create({ kind: 'claude-code', label: 'A' });
    repo.create({ kind: 'gemini-cli', label: 'B' });
    expect(repo.list()).toHaveLength(2);
  });

  it('update changes label and config without touching the key', () => {
    const id = repo.create({ kind: 'claude-code', label: 'Old' });
    repo.update(id, { label: 'New', config: { defaultModel: 'sonnet' } });
    const got = repo.get(id)!;
    expect(got.label).toBe('New');
    expect(got.config).toEqual({ defaultModel: 'sonnet' });
  });

  it('delete removes the row', () => {
    const id = repo.create({ kind: 'claude-code', label: 'X' });
    repo.delete(id);
    expect(repo.get(id)).toBeNull();
  });
});
