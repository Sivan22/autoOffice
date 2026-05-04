import { describe, it, expect } from 'vitest';
import { wrapSecret, unwrapSecret, isDpapiAvailable } from './dpapi';

const isWindows = process.platform === 'win32';

describe.runIf(isWindows)('DPAPI (Windows)', () => {
  it('round-trips a secret', () => {
    expect(isDpapiAvailable()).toBe(true);
    const ciphertext = wrapSecret('hunter2');
    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(ciphertext.byteLength).toBeGreaterThan(0);
    const back = unwrapSecret(ciphertext);
    expect(back).toBe('hunter2');
  });
});

describe.skipIf(isWindows)('DPAPI (non-Windows)', () => {
  it('reports unavailable and refuses to wrap', () => {
    expect(isDpapiAvailable()).toBe(false);
    expect(() => wrapSecret('x')).toThrow(/Windows/);
  });

  it('refuses to unwrap on non-Windows', () => {
    expect(() => unwrapSecret(new Uint8Array([1, 2, 3]))).toThrow(/Windows/);
  });
});
