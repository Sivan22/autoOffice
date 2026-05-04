import { describe, it, expect } from 'vitest';
import { pack } from './pack';

describe('pack', () => {
  it('returns null on an empty blob', () => {
    expect(pack({ roamingSettingsRaw: null, localStorageConvs: null })).toBeNull();
  });

  it('extracts settings + conversations', () => {
    const out = pack({
      roamingSettingsRaw: { 'autoOffice.settings': { locale: 'he', autoApprove: true } },
      localStorageConvs: [{ id: 'c1', title: 'T', host: 'word', messages: [] }],
    });
    expect(out!.settings).toEqual({ locale: 'he', autoApprove: true });
    expect(out!.conversations).toHaveLength(1);
  });

  it('defaults host to word for unknown values', () => {
    const out = pack({
      roamingSettingsRaw: null,
      localStorageConvs: [{ id: 'c1', host: 'outlook', messages: [] }],
    });
    expect(out!.conversations[0].host).toBe('word');
  });
});
