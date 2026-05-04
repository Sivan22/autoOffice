import { Hono } from 'hono';

const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function bootstrapRouter(opts: { token: string; version: string }) {
  const r = new Hono();
  r.get('/', (c) => {
    // Browsers don't send Origin on same-origin GETs, so accept that case.
    // Reject only when an Origin is explicitly present and points elsewhere.
    const origin = c.req.header('Origin');
    if (origin !== undefined && origin !== '' && !ALLOWED_ORIGIN.test(origin)) {
      return c.json({ error: 'forbidden' }, 403);
    }
    return c.json({ token: opts.token, version: opts.version });
  });
  return r;
}
