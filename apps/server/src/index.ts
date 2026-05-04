import { createApp } from './app';
import { HOST, PORT, VERSION } from './env';

const app = createApp({ version: VERSION });

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch: app.fetch,
});

console.log(`[autoOffice] listening on http://${server.hostname}:${server.port}`);
