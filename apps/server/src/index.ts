import { createApp } from './app';
import { openDb } from './db/index';
import { AUTH_TOKEN, HOST, IS_DEV, PORT, VERSION, dbPath } from './env';

const db = openDb({ url: dbPath() });
const app = createApp({ version: VERSION, db, authToken: AUTH_TOKEN });

if (IS_DEV) {
  const { makeViteMiddleware } = await import('./middleware/vite-dev');
  app.use('*', await makeViteMiddleware());
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: app.fetch,
});

console.log(`[autoOffice] ${IS_DEV ? 'dev' : 'prod'} listening on http://${server.hostname}:${server.port}`);
console.log(`[autoOffice] data dir = ${dbPath()}`);
