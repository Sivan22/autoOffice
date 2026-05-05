import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db/index';
import { createApp } from '../app';

const TOKEN = 'test-token';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

describe('conversations routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 'test', db, authToken: TOKEN });
  });

  it('GET /api/conversations on empty db returns []', async () => {
    const res = await app.request('/api/conversations', { headers: auth });
    expect(await res.json()).toEqual([]);
  });

  it('POST creates a conversation and returns id', async () => {
    const res = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ host: 'word' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/^c_/);
  });

  it('GET /:id returns conversation with messages: []', async () => {
    const created = await (
      await app.request('/api/conversations', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ host: 'excel' }),
      })
    ).json();
    const res = await app.request(`/api/conversations/${created.id}`, { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversation.host).toBe('excel');
    expect(body.messages).toEqual([]);
  });

  it('PATCH renames the conversation', async () => {
    const c = await (
      await app.request('/api/conversations', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ host: 'word' }),
      })
    ).json();
    const r = await app.request(`/api/conversations/${c.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ title: 'Sprint plan' }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.title).toBe('Sprint plan');
  });

  it('DELETE returns 204', async () => {
    const c = await (
      await app.request('/api/conversations', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ host: 'word' }),
      })
    ).json();
    const r = await app.request(`/api/conversations/${c.id}`, {
      method: 'DELETE',
      headers: auth,
    });
    expect(r.status).toBe(204);
    const list = await (await app.request('/api/conversations', { headers: auth })).json();
    expect(list).toHaveLength(0);
  });

  it('honors a client-supplied id and is idempotent on resend', async () => {
    const id = 'c_01J9ZK8R0YQ3WBE2DXG5T7HMNA';
    const r1 = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ id, host: 'word' }),
    });
    expect(r1.status).toBe(201);
    expect((await r1.json()).id).toBe(id);

    const r2 = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ id, host: 'word' }),
    });
    expect(r2.status).toBe(200);
    expect((await r2.json()).id).toBe(id);

    const list = await (await app.request('/api/conversations', { headers: auth })).json();
    expect(list).toHaveLength(1);
  });

  it('rejects invalid host in POST', async () => {
    const r = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ host: 'outlook' }),
    });
    expect(r.status).toBe(400);
  });
});
