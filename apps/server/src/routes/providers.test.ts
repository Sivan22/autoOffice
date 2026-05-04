import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

describe('providers routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 'test', db, authToken: TOKEN });
  });

  it('GET /api/providers returns []', async () => {
    const res = await app.request('/api/providers', { headers: auth });
    expect(await res.json()).toEqual([]);
  });

  it('POST /api/providers creates a CLI-bridge provider', async () => {
    const r = await app.request('/api/providers', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ kind: 'claude-code', label: 'My Claude' }),
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.id).toMatch(/^p_/);
    const list = await (await app.request('/api/providers', { headers: auth })).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'claude-code', hasKey: false });
  });

  it('PUT updates label', async () => {
    const id = (
      await (
        await app.request('/api/providers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ kind: 'claude-code', label: 'Old' }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/providers/${id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ label: 'New' }),
    });
    expect(r.status).toBe(200);
    const got = await r.json();
    expect(got.label).toBe('New');
  });

  it('DELETE removes', async () => {
    const id = (
      await (
        await app.request('/api/providers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ kind: 'claude-code', label: 'X' }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/providers/${id}`, { method: 'DELETE', headers: auth });
    expect(r.status).toBe(204);
  });

  it('rejects POST with invalid kind', async () => {
    const r = await app.request('/api/providers', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ kind: 'cohere', label: 'X' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /:id/test returns the readiness status', async () => {
    const id = (
      await (
        await app.request('/api/providers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ kind: 'claude-code', label: 'X' }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/providers/${id}/test`, { method: 'POST', headers: auth });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(['ready', 'cli-not-found', 'cli-not-authed', 'unknown']).toContain(body.status);
  });
});
