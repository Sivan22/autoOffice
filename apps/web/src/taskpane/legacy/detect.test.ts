import { describe, it, expect, beforeEach } from 'vitest';
import { detectLegacy, clearLegacy } from './detect';

beforeEach(() => {
  (window as any).localStorage = {
    _s: new Map<string, string>(),
    getItem(k: string) { return this._s.get(k) ?? null; },
    setItem(k: string, v: string) { this._s.set(k, v); },
    removeItem(k: string) { this._s.delete(k); },
    clear() { this._s.clear(); },
  };
  (globalThis as any).Office = undefined;
});

describe('detectLegacy', () => {
  it('returns nulls when nothing is stored', () => {
    const r = detectLegacy();
    expect(r.roamingSettingsRaw).toBeNull();
    expect(r.localStorageConvs).toBeNull();
  });

  it('reads localStorage conversations', () => {
    window.localStorage.setItem('autoOffice.conversations', JSON.stringify([{ id: 'x' }]));
    const r = detectLegacy();
    expect(r.localStorageConvs).toEqual([{ id: 'x' }]);
  });

  it('reads roamingSettings entries', () => {
    (globalThis as any).Office = { context: { roamingSettings: {
      get: (k: string) => (k === 'autoOffice.settings' ? { autoApprove: true } : null),
    } } };
    const r = detectLegacy();
    expect(r.roamingSettingsRaw).toEqual({ 'autoOffice.settings': { autoApprove: true } });
  });
});

describe('clearLegacy', () => {
  it('removes the localStorage keys', () => {
    window.localStorage.setItem('autoOffice.conversations', '[]');
    clearLegacy();
    expect(window.localStorage.getItem('autoOffice.conversations')).toBeNull();
  });
});
