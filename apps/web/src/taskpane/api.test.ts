import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrap, apiGet, apiSend, getTokenForTests, _resetForTests } from './api';

describe('api', () => {
  beforeEach(() => {
    _resetForTests();
    (globalThis as any).fetch = vi.fn();
  });

  it('bootstrap stores the token returned by /bootstrap', async () => {
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ token: 't', version: 'v' }), { status: 200 }));
    await bootstrap();
    expect(getTokenForTests()).toBe('t');
  });

  it('apiGet attaches Authorization header', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'tk', version: 'v' }), { status: 200 }),
    );
    await bootstrap();
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await apiGet('/api/settings');
    const lastCall = (fetch as any).mock.calls.at(-1);
    expect((lastCall[1].headers as any).Authorization).toBe('Bearer tk');
  });

  it('apiSend posts JSON with Authorization + Content-Type', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 't2', version: 'v' }), { status: 200 }),
    );
    await bootstrap();
    (fetch as any).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'x' }), { status: 200 }));
    await apiSend('/api/conversations', { host: 'word' });
    const lastCall = (fetch as any).mock.calls.at(-1);
    expect(lastCall[1].method).toBe('POST');
    expect((lastCall[1].headers as any).Authorization).toBe('Bearer t2');
    expect((lastCall[1].headers as any)['Content-Type']).toBe('application/json');
    expect(lastCall[1].body).toBe(JSON.stringify({ host: 'word' }));
  });

  it('apiSend returns undefined on 204', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 't3', version: 'v' }), { status: 200 }),
    );
    await bootstrap();
    (fetch as any).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const r = await apiSend('/api/conversations/c1', null, 'DELETE');
    expect(r).toBeUndefined();
  });

  it('apiGet rejects when bootstrap was not called', async () => {
    await expect(apiGet('/api/settings')).rejects.toThrow(/bootstrap/i);
  });

  it('bootstrap throws if response not ok', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('forbidden', { status: 403 }));
    await expect(bootstrap()).rejects.toThrow(/403/);
  });

  it('apiGet throws on non-2xx', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 't4', version: 'v' }), { status: 200 }),
    );
    await bootstrap();
    (fetch as any).mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(apiGet('/api/settings')).rejects.toThrow(/500/);
  });

  it('apiSend surfaces JSON error body in the thrown message', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 't5', version: 'v' }), { status: 200 }),
    );
    await bootstrap();
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'API key requires Windows (DPAPI)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(
      apiSend('/api/providers', { kind: 'anthropic', label: 'x', apiKey: 'sk' }),
    ).rejects.toThrow(/API key requires Windows \(DPAPI\)/);
  });
});
