import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bearerAuth } from './auth';

describe('bearerAuth', () => {
  function makeApp(token: string) {
    const app = new Hono();
    app.get('/health', (c) => c.json({ ok: true }));
    app.use('/api/*', bearerAuth(token));
    app.get('/api/secret', (c) => c.json({ secret: 'shh' }));
    return app;
  }

  it('allows /health without token', async () => {
    const app = makeApp('t1');
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });

  it('rejects /api/* without Authorization', async () => {
    const app = makeApp('t1');
    const res = await app.request('/api/secret');
    expect(res.status).toBe(401);
  });

  it('rejects /api/* with wrong token', async () => {
    const app = makeApp('t1');
    const res = await app.request('/api/secret', {
      headers: { Authorization: 'Bearer wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts /api/* with correct token', async () => {
    const app = makeApp('t1');
    const res = await app.request('/api/secret', {
      headers: { Authorization: 'Bearer t1' },
    });
    expect(res.status).toBe(200);
  });
});
