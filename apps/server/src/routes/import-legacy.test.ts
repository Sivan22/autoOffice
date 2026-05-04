import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

const TOKEN = 'tok';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

describe('/api/import-legacy', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({ version: 't', db, authToken: TOKEN });
  });

  it('imports settings on a fresh db', async () => {
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ settings: { autoApprove: true, locale: 'he' } }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.importedSettings).toBe(true);
    const s = await (await app.request('/api/settings', { headers: auth })).json();
    expect(s.autoApprove).toBe(true);
    expect(s.locale).toBe('he');
  });

  it('skips settings if already non-default', async () => {
    await app.request('/api/settings', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ autoApprove: true }),
    });
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ settings: { autoApprove: false } }),
    });
    const body = await r.json();
    expect(body.importedSettings).toBe(false);
    expect(body.skippedReason).toMatch(/settings already exist/i);
  });

  it('imports conversations and messages', async () => {
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        conversations: [
          {
            id: 'c_legacy_1',
            title: 'Old chat',
            host: 'word',
            createdAt: 1,
            updatedAt: 2,
            messages: [
              { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }], metadata: null, createdAt: 1 },
              { id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'hey' }], metadata: null, createdAt: 2 },
            ],
          },
        ],
      }),
    });
    const body = await r.json();
    expect(body.importedConversationCount).toBe(1);
    expect(body.importedMessageCount).toBe(2);

    const list = await (await app.request('/api/conversations', { headers: auth })).json();
    expect(list).toHaveLength(1);
    const detail = await (await app.request(`/api/conversations/${list[0].id}`, { headers: auth })).json();
    expect(detail.messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
  });

  it('rejects malformed payloads with 400', async () => {
    const r = await app.request('/api/import-legacy', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ conversations: [{ id: 'x' }] }),
    });
    expect(r.status).toBe(400);
  });
});
