import { describe, it, expect } from 'vitest';
import { generateCert } from './generate';

describe('generateCert', () => {
  it('produces a key+cert pair with localhost SAN and 10y validity', () => {
    const { key, cert, fingerprint, notAfter, notBefore } = generateCert({ commonName: 'AutoOffice (test)', validityYears: 10 });
    expect(key).toMatch(/-----BEGIN (RSA |)PRIVATE KEY-----/);
    expect(cert).toMatch(/-----BEGIN CERTIFICATE-----/);
    expect(fingerprint).toMatch(/^[A-F0-9:]+$/);
    const ms = notAfter.getTime() - notBefore.getTime();
    const tenYearMs = 10 * 365 * 24 * 60 * 60 * 1000;
    expect(Math.abs(ms - tenYearMs)).toBeLessThan(7 * 24 * 60 * 60 * 1000); // ±1w slack
  });
});
