import { createApp } from './app';
import { HOST, IS_DEV, PORT, VERSION } from './env';

const app = createApp({ version: VERSION });

if (IS_DEV) {
  const { makeViteMiddleware } = await import('./middleware/vite-dev');
  app.use('*', await makeViteMiddleware());
} else {
  // Production static-serve added in plan 05.
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: app.fetch,
});

console.log(`[autoOffice] ${IS_DEV ? 'dev' : 'prod'} listening on http://${server.hostname}:${server.port}`);
