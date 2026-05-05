import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db/index';
import { createApp } from '../app';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}` };

describe('settings routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 'test', db, authToken: TOKEN });
  });

  it('GET /api/settings returns defaults on a fresh db', async () => {
    const res = await app.request('/api/settings', { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ locale: 'en', autoApprove: false, maxSteps: 20 });
  });

  it('PUT /api/settings persists a partial update', async () => {
    const res = await app.request('/api/settings', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoApprove: true, maxSteps: 10 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ autoApprove: true, maxSteps: 10 });

    const res2 = await app.request('/api/settings', { headers: auth });
    expect((await res2.json()).autoApprove).toBe(true);
  });

  it('PUT rejects an invalid maxSteps', async () => {
    const res = await app.request('/api/settings', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSteps: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT accepts a known locale and rejects an unknown one', async () => {
    const ok = await app.request('/api/settings', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'he' }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).locale).toBe('he');

    const bad = await app.request('/api/settings', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'zz' }),
    });
    expect(bad.status).toBe(400);
  });
});
