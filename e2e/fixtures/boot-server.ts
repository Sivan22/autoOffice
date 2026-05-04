import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test as base } from '@playwright/test';

type Fixtures = { server: { proc: ChildProcess; token: string; dataDir: string } };

const REPO_ROOT = resolve(__dirname, '..', '..');

export const test = base.extend<Fixtures>({
  server: async ({}, use) => {
    const dataDir = mkdtempSync(join(tmpdir(), 'autoo-e2e-'));
    const token = 'e2e-token';
    const env = {
      ...process.env,
      AUTOOFFICE_TOKEN: token,
      AUTOOFFICE_DATA_DIR: dataDir,
      AUTOOFFICE_TEST_PROVIDER: 'fake',
      NODE_ENV: 'development',
    };
    const proc = spawn('bun', ['--watch', 'apps/server/src/index.ts'], {
      cwd: REPO_ROOT,
      env,
      stdio: 'inherit',
    });

    // wait for /health to come up
    await waitForHealth('http://localhost:47318/health');

    await use({ proc, token, dataDir });

    proc.kill('SIGINT');
    rmSync(dataDir, { recursive: true, force: true });
  },
});

async function waitForHealth(url: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not come up');
}
