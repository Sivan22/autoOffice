import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './app';
import { openDb } from './db/index';
import { HOST, IS_DEV, VERSION, dbPath, resolveDataDir, AUTH_TOKEN } from './env';
import { parseArgv } from './cli';
import { firstRunInit } from './cli/first-run-init';
import { acquireLock, releaseLock } from './lifecycle/single-instance';
import { loadConfig, rotateToken } from './lifecycle/config';
import { startTray } from './tray';

const cmd = parseArgv(process.argv);

if (cmd === 'first-run-init') {
  await firstRunInit();
  process.exit(0);
}

if (cmd === 'rotate-token') {
  const cfg = rotateToken(resolveDataDir());
  console.log(`[autoOffice] new token written. Length: ${cfg.token.length}`);
  process.exit(0);
}

// --- normal serve path ---
const dataDir = resolveDataDir();
const cfg = loadConfig(dataDir);
const token = cfg?.token ?? AUTH_TOKEN;
const port = cfg?.port ?? 47318;

const lock = acquireLock(dataDir);
if (!lock) {
  console.error('[autoOffice] another instance is already running. Exiting.');
  process.exit(0);
}

const db = openDb({ url: dbPath() });
const app = createApp({ version: VERSION, db, authToken: token });

if (IS_DEV) {
  const { makeViteMiddleware } = await import('./middleware/vite-dev');
  app.use('*', await makeViteMiddleware());
}

let serveOpts: Parameters<typeof Bun.serve>[0] = {
  hostname: HOST,
  port,
  fetch: app.fetch,
};

if (cfg?.certPath && cfg?.keyPath) {
  serveOpts = {
    ...serveOpts,
    tls: {
      cert: readFileSync(join(dataDir, cfg.certPath)),
      key: readFileSync(join(dataDir, cfg.keyPath)),
    },
  };
}

const server = Bun.serve(serveOpts);
const scheme = serveOpts.tls ? 'https' : 'http';
console.log(`[autoOffice] ${IS_DEV ? 'dev' : 'prod'} listening on ${scheme}://${server.hostname}:${server.port}`);
console.log(`[autoOffice] data dir = ${dataDir}`);

if (!IS_DEV && process.platform === 'win32') {
  startTray({ port, dataDir }).catch((err) => console.error('tray failed', err));
}

process.on('SIGINT', () => { releaseLock(lock); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(lock); process.exit(0); });
