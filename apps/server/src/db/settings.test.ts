import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { SettingsRepo } from './settings';
import { DEFAULT_SETTINGS } from '@autooffice/shared';

describe('SettingsRepo', () => {
  let repo: SettingsRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    repo = new SettingsRepo(db);
  });

  it('returns DEFAULT_SETTINGS on a fresh db', () => {
    expect(repo.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists a partial update', () => {
    repo.update({ autoApprove: true, maxSteps: 7 });
    const next = repo.get();
    expect(next.autoApprove).toBe(true);
    expect(next.maxSteps).toBe(7);
    expect(next.locale).toBe(DEFAULT_SETTINGS.locale);
  });

  it('rejects invalid values', () => {
    expect(() => repo.update({ maxSteps: 0 })).toThrow();
  });
});
