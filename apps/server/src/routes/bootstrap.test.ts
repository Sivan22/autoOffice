import { describe, it, expect } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

describe('GET /bootstrap', () => {
  function mk(token: string) {
    const db = openDb({ url: ':memory:' });
    return createApp({ version: 't', db, authToken: token });
  }

  it('rejects requests with a bad Origin', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(r.status).toBe(403);
  });

  it('returns token + version when Origin is correct', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap', {
      headers: { Origin: 'https://localhost:47318' },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.token).toBe('tok');
    expect(typeof body.version).toBe('string');
  });

  it('also accepts http://localhost:<port> in dev', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap', {
      headers: { Origin: 'http://localhost:47318' },
    });
    expect(r.status).toBe(200);
  });

  it('accepts requests with no Origin header (same-origin GET)', async () => {
    const app = mk('tok');
    const r = await app.request('/bootstrap');
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.token).toBe('tok');
  });
});
