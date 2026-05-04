import { describe, it, expect, vi } from 'vitest';
import { installCertToCurrentUserRoot } from './install-store';

const isWin = process.platform === 'win32';

describe.skipIf(isWin)('installCertToCurrentUserRoot (non-Windows)', () => {
  it('throws clearly', async () => {
    await expect(installCertToCurrentUserRoot('PEM')).rejects.toThrow(/Windows/);
  });
});

describe.runIf(isWin)('installCertToCurrentUserRoot (Windows)', () => {
  it('rejects empty input', async () => {
    await expect(installCertToCurrentUserRoot('')).rejects.toThrow();
  });
});
