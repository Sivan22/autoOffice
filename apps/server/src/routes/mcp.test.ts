import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb } from '../db';
import { createApp } from '../app';

const TOKEN = 'tok';
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

function fakeMcp(toolNames: string[]) {
  return {
    async tools() {
      return Object.fromEntries(toolNames.map((n) => [n, { description: n, inputSchema: {}, execute: vi.fn() }]));
    },
    async close() {},
  };
}

describe('mcp routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    app = createApp({
      version: 'test',
      db,
      authToken: TOKEN,
      mcpClientFactory: async () => fakeMcp(['list_files', 'read_file']) as any,
    });
  });

  it('GET /api/mcp/servers on empty db returns []', async () => {
    const r = await app.request('/api/mcp/servers', { headers: auth });
    expect(await r.json()).toEqual([]);
  });

  it('POST /api/mcp/servers eagerly connects', async () => {
    const r = await app.request('/api/mcp/servers', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        label: 'fs',
        timeoutSeconds: 60,
        defaultPolicy: 'ask',
        disabled: false,
        spec: { transport: 'stdio', command: 'node', args: ['fs.js'], env: {}, cwd: null },
      }),
    });
    expect(r.status).toBe(201);
    const { id } = await r.json();
    // give the eager connect a tick
    await new Promise((res) => setTimeout(res, 5));
    const v = await (await app.request(`/api/mcp/servers/${id}`, { headers: auth })).json();
    expect(v.status).toBe('connected');
    expect(v.tools.map((t: any) => t.name).sort()).toEqual(['list_files', 'read_file']);
  });

  it('PUT updates default policy live (no reconnect needed)', async () => {
    const id = (
      await (
        await app.request('/api/mcp/servers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            label: 'fs',
            timeoutSeconds: 60,
            defaultPolicy: 'ask',
            disabled: false,
            spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
          }),
        })
      ).json()
    ).id;
    await new Promise((res) => setTimeout(res, 5));
    const r = await app.request(`/api/mcp/servers/${id}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ defaultPolicy: 'allow' }),
    });
    expect(r.status).toBe(200);
    const v = await r.json();
    expect(v.defaultPolicy).toBe('allow');
    expect(v.tools.every((t: any) => t.policy === 'allow')).toBe(true);
  });

  it('PUT /:id/tools/:tool overrides single-tool policy', async () => {
    const id = (
      await (
        await app.request('/api/mcp/servers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            label: 'fs',
            timeoutSeconds: 60,
            defaultPolicy: 'ask',
            disabled: false,
            spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
          }),
        })
      ).json()
    ).id;
    await new Promise((res) => setTimeout(res, 5));
    const r = await app.request(`/api/mcp/servers/${id}/tools/list_files`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ policy: 'deny' }),
    });
    expect(r.status).toBe(200);
    const v = await (await app.request(`/api/mcp/servers/${id}`, { headers: auth })).json();
    const lf = v.tools.find((t: any) => t.name === 'list_files');
    expect(lf.policy).toBe('deny');
  });

  it('DELETE removes the server', async () => {
    const id = (
      await (
        await app.request('/api/mcp/servers', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            label: 'fs',
            timeoutSeconds: 60,
            defaultPolicy: 'ask',
            disabled: false,
            spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
          }),
        })
      ).json()
    ).id;
    const r = await app.request(`/api/mcp/servers/${id}`, { method: 'DELETE', headers: auth });
    expect(r.status).toBe(204);
    expect(await (await app.request('/api/mcp/servers', { headers: auth })).json()).toHaveLength(0);
  });
});
