import { describe, it, expect } from 'vitest';
import { parseArgv } from './index';

describe('parseArgv', () => {
  it('returns "first-run-init" when --first-run-init present', () => {
    expect(parseArgv(['node', 'index.js', '--first-run-init'])).toBe('first-run-init');
  });

  it('returns "rotate-token" when --rotate-token present', () => {
    expect(parseArgv(['node', 'index.js', '--rotate-token'])).toBe('rotate-token');
  });

  it('returns "cert-uninstall" when --cert-uninstall present', () => {
    expect(parseArgv(['node', 'index.js', '--cert-uninstall'])).toBe('cert-uninstall');
  });

  it('returns "serve" by default', () => {
    expect(parseArgv(['node', 'index.js'])).toBe('serve');
  });
});
