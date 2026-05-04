import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { ConversationsRepo } from './conversations';

describe('ConversationsRepo', () => {
  let repo: ConversationsRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new ConversationsRepo(db);
  });

  it('creates and reads back a conversation', () => {
    const id = repo.create({ host: 'word', providerId: null, modelId: null });
    expect(id).toMatch(/^c_/);
    const got = repo.get(id);
    expect(got).toMatchObject({ id, host: 'word', title: null });
    expect(got!.createdAt).toBeGreaterThan(0);
  });

  it('lists conversations newest first', async () => {
    const a = repo.create({ host: 'word' });
    await new Promise((r) => setTimeout(r, 5));
    const b = repo.create({ host: 'excel' });
    const list = repo.list();
    expect(list[0]!.id).toBe(b);
    expect(list[1]!.id).toBe(a);
  });

  it('rename updates title and updatedAt', async () => {
    const id = repo.create({ host: 'word' });
    const before = repo.get(id)!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    repo.rename(id, 'Hello');
    const after = repo.get(id)!;
    expect(after.title).toBe('Hello');
    expect(after.updatedAt).toBeGreaterThan(before);
  });

  it('delete cascades and removes the row', () => {
    const id = repo.create({ host: 'word' });
    repo.delete(id);
    expect(repo.get(id)).toBeNull();
  });
});
