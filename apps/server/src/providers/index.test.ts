import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { ProvidersRepo } from '../db/providers';
import { ProviderRegistry } from './index';

const isWin = process.platform === 'win32';

describe('ProviderRegistry', () => {
  let repo: ProvidersRepo;
  let reg: ProviderRegistry;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new ProvidersRepo(db);
    reg = new ProviderRegistry(repo);
  });

  it('returns null for unknown id', async () => {
    expect(await reg.resolve('p_nope', 'x')).toBeNull();
  });

  it.runIf(isWin)('resolves a stored Anthropic config to a LanguageModel', async () => {
    const id = repo.create({ kind: 'anthropic', label: 'A', apiKey: 'sk-test' });
    const model = await reg.resolve(id, 'claude-sonnet-4-6');
    expect(model).not.toBeNull();
    expect(typeof (model as any).provider).toBe('string'); // AI SDK LanguageModel has .provider
  });

  it('resolves a CLI bridge without a key', async () => {
    const id = repo.create({ kind: 'claude-code', label: 'C' });
    const model = await reg.resolve(id, 'claude-opus-4-7');
    expect(model).not.toBeNull();
  });
});
