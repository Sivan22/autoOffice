import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';
import type { LanguageModel } from 'ai';

const TOKEN = 'tok';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// A toy LanguageModel that always emits a single text response.
function fakeModel(text: string): LanguageModel {
  return {
    specificationVersion: 'v2',
    provider: 'fake',
    modelId: 'fake-1',
    async doStream() {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 't0' });
            controller.enqueue({ type: 'text-delta', id: 't0', delta: text });
            controller.enqueue({ type: 'text-end', id: 't0' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  } as unknown as LanguageModel;
}

describe('POST /api/chat', () => {
  let app: ReturnType<typeof createApp>;
  let convId: string;

  beforeEach(async () => {
    const db = openDb({ url: ':memory:' });
    app = createApp({
      version: 'test',
      db,
      authToken: TOKEN,
      mcpClientFactory: async () =>
        ({
          async tools() {
            return {};
          },
          async close() {},
        } as any),
      modelOverride: () => fakeModel('Hello from fake'),
    });
    const r = await app.request('/api/conversations', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ host: 'word' }),
    });
    convId = (await r.json()).id;
  });

  it('streams a UI message stream and persists messages', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        id: convId,
        host: 'word',
        providerId: 'p_unused',
        modelId: 'fake-1',
        trigger: 'submit-message',
        message: { id: 'msg_user_1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream|application\/json/);

    // drain the stream
    const reader = res.body!.getReader();
    let chunks = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks += new TextDecoder().decode(value);
    }
    expect(chunks).toContain('Hello from fake');

    // give onFinish a tick
    await new Promise((r) => setTimeout(r, 30));

    const conv = await (
      await app.request(`/api/conversations/${convId}`, { headers: auth })
    ).json();
    expect(conv.messages.length).toBeGreaterThanOrEqual(2);
    expect(conv.messages.at(-1).role).toBe('assistant');
  });

  it('returns 400 with "no model picked" when modelId is empty', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        id: convId,
        host: 'word',
        providerId: 'p_unused',
        modelId: '',
        trigger: 'submit-message',
        message: { id: 'msg_x', role: 'user', parts: [{ type: 'text', text: 'x' }] },
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('no model picked');
  });

  it('returns 404 for unknown conversation', async () => {
    const res = await app.request('/api/chat', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        id: 'c_nope',
        host: 'word',
        providerId: 'p',
        modelId: 'fake-1',
        trigger: 'submit-message',
        message: { id: 'msg_x', role: 'user', parts: [{ type: 'text', text: 'x' }] },
      }),
    });
    expect(res.status).toBe(404);
  });
});
