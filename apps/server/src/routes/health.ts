import { Hono } from 'hono';

const startedAt = Date.now();

export function healthRouter(version: string) {
  const r = new Hono();
  r.get('/health', (c) =>
    c.json({
      ok: true,
      version,
      pid: process.pid,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      port: Number(process.env.AUTOOFFICE_PORT ?? 47318),
    }),
  );
  return r;
}
