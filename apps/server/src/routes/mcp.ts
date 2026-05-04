import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  CreateMcpServerInputSchema,
  McpPolicySchema,
  UpdateMcpServerInputSchema,
} from '@autooffice/shared';
import type { McpHub } from '../mcp/hub';
import type { McpServersRepo, McpToolPoliciesRepo } from '../db/mcp';
import { mcpEvents } from '../mcp/events';

export function mcpRouter(hub: McpHub, servers: McpServersRepo, policies: McpToolPoliciesRepo) {
  const r = new Hono();

  r.get('/servers', (c) => c.json(hub.listViews()));

  r.get('/servers/:id', (c) => {
    const v = hub.getView(c.req.param('id'));
    return v ? c.json(v) : c.json({ error: 'not found' }, 404);
  });

  r.post('/servers', async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = CreateMcpServerInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    const id = servers.create(parsed.data);
    if (!parsed.data.disabled) {
      hub.connect(id).catch(() => {});
    } else {
      // ensure view reflects disabled state
      hub.disable(id).catch(() => {});
    }
    return c.json({ id }, 201);
  });

  r.put('/servers/:id', async (c) => {
    const id = c.req.param('id');
    if (!servers.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = UpdateMcpServerInputSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid', issues: parsed.error.issues }, 400);
    servers.update(id, parsed.data);
    await hub.refreshConfig(id);
    return c.json(hub.getView(id));
  });

  r.delete('/servers/:id', async (c) => {
    const id = c.req.param('id');
    await hub.remove(id);
    servers.delete(id);
    return c.body(null, 204);
  });

  r.post('/servers/:id/restart', async (c) => {
    const id = c.req.param('id');
    if (!servers.get(id)) return c.json({ error: 'not found' }, 404);
    await hub.remove(id);
    await hub.connect(id);
    return c.json(hub.getView(id));
  });

  r.get('/servers/:id/tools', (c) => {
    const v = hub.getView(c.req.param('id'));
    return v ? c.json(v.tools) : c.json({ error: 'not found' }, 404);
  });

  r.put('/servers/:id/tools/:tool', async (c) => {
    const id = c.req.param('id');
    const tool = c.req.param('tool');
    if (!servers.get(id)) return c.json({ error: 'not found' }, 404);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'invalid json' }, 400); }
    const parsed = McpPolicySchema.safeParse((body as any)?.policy);
    if (!parsed.success) return c.json({ error: 'invalid policy' }, 400);
    policies.set(id, tool, parsed.data);
    await hub.refreshPolicies(id);
    return c.json(hub.getView(id));
  });

  r.get('/servers/:id/log', (c) => {
    const id = c.req.param('id');
    const lines = hub.getStderrLog(id);
    return c.json({ lines });
  });

  r.get('/events', (c) =>
    streamSSE(c, async (stream) => {
      const handler = (ev: { serverId: string; status: string; errorMessage?: string | null; toolCount?: number }) =>
        stream.writeSSE({ event: 'status', data: JSON.stringify(ev) });
      mcpEvents.onStatus(handler);
      try {
        // Send initial snapshot.
        for (const v of hub.listViews()) {
          await stream.writeSSE({
            event: 'status',
            data: JSON.stringify({ serverId: v.id, status: v.status, errorMessage: v.errorMessage, toolCount: v.tools.length }),
          });
        }
        // Keep alive until the client disconnects.
        await new Promise<void>((resolve) => stream.onAbort(resolve));
      } finally {
        mcpEvents.offStatus(handler);
      }
    }),
  );

  return r;
}
