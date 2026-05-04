import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveConfig, makeFreshConfig } from '../lifecycle/config';

// install-store.uninstallCertByFingerprint is a no-op on non-Windows, so on
// CI/Linux we can run cert-uninstall end-to-end safely. The point of these
// tests is that cert-uninstall correctly reads the fingerprint from config.
describe('certUninstall', () => {
  let dir: string;
  const origDataDir = process.env.AUTOOFFICE_DATA_DIR;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aoffice-cu-'));
    process.env.AUTOOFFICE_DATA_DIR = dir;
  });

  afterEach(() => {
    if (origDataDir === undefined) delete process.env.AUTOOFFICE_DATA_DIR;
    else process.env.AUTOOFFICE_DATA_DIR = origDataDir;
    rmSync(dir, { recursive: true, force: true });
  });

  it('logs "no fingerprint" when no config exists', async () => {
    const { certUninstall } = await import('./cert-uninstall');
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try {
      await certUninstall();
    } finally {
      console.log = origLog;
    }
    expect(logs.some((l) => l.includes('no fingerprint'))).toBe(true);
  });

  it('logs "no fingerprint" when fingerprint is null', async () => {
    const cfg = makeFreshConfig({ port: 47318 });
    saveConfig(dir, cfg);
    const { certUninstall } = await import('./cert-uninstall');
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try {
      await certUninstall();
    } finally {
      console.log = origLog;
    }
    expect(logs.some((l) => l.includes('no fingerprint'))).toBe(true);
  });

  it('reaches the uninstall path when fingerprint present (non-Windows: no-op)', async () => {
    const cfg = makeFreshConfig({ port: 47318 });
    cfg.certFingerprint = 'ABCDEF0123456789';
    saveConfig(dir, cfg);
    const { certUninstall } = await import('./cert-uninstall');
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => { logs.push(args.join(' ')); };
    try {
      await certUninstall();
    } finally {
      console.log = origLog;
    }
    // On non-Windows uninstallCertByFingerprint is a no-op, but we still log "cert removed"
    if (process.platform !== 'win32') {
      expect(logs.some((l) => l.includes('cert removed'))).toBe(true);
    }
  });
});
