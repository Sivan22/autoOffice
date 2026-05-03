import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadStoredLocale, saveStoredLocale, STORAGE_KEY } from './storage.ts';

describe('storage (localStorage path)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadStoredLocale()).toBeNull();
  });

  it('roundtrips a registered locale', () => {
    saveStoredLocale('he');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('he');
    expect(loadStoredLocale()).toBe('he');
  });

  it('returns null for stored values not in the registry', () => {
    localStorage.setItem(STORAGE_KEY, 'xx');
    expect(loadStoredLocale()).toBeNull();
  });

  it('uses Office.context.roamingSettings when present', () => {
    const store = new Map<string, string>();
    const roaming = {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => { store.set(k, v); },
      saveAsync: () => {},
    };
    vi.stubGlobal('Office', { context: { roamingSettings: roaming } });
    saveStoredLocale('he');
    expect(store.get(STORAGE_KEY)).toBe('he');
    expect(loadStoredLocale()).toBe('he');
  });
});
