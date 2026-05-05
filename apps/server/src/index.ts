import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
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

if (cmd === 'cert-uninstall') {
  const { certUninstall } = await import('./cli/cert-uninstall');
  await certUninstall();
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
const app = createApp({ version: VERSION, db, authToken: token, dev: IS_DEV });

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
} else if (IS_DEV && process.env.AUTOOFFICE_NO_TLS !== '1') {
  // Dev fallback: pick up office-addin-dev-certs so Office (which loads the
  // task pane over HTTPS per the manifest) can reach this server.
  const devCertDir = join(homedir(), '.office-addin-dev-certs');
  const devCert = join(devCertDir, 'localhost.crt');
  const devKey = join(devCertDir, 'localhost.key');
  if (existsSync(devCert) && existsSync(devKey)) {
    serveOpts = {
      ...serveOpts,
      tls: {
        cert: readFileSync(devCert),
        key: readFileSync(devKey),
      },
    };
  } else {
    console.warn(
      `[autoOffice] dev TLS certs not found at ${devCertDir}. ` +
        'Run `npm --workspace @autooffice/web run certs` to install them, ' +
        'or set AUTOOFFICE_NO_TLS=1 to silence this warning.',
    );
  }
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
