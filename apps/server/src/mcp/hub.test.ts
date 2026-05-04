import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb } from '../db';
import { McpServersRepo, McpToolPoliciesRepo } from '../db/mcp';
import { McpHub } from './hub';

// Minimal fake AI SDK MCP client for in-process tests.
function makeFakeClient(toolNames: string[]) {
  return {
    async tools() {
      return Object.fromEntries(
        toolNames.map((n) => [
          n,
          {
            description: `desc ${n}`,
            inputSchema: { type: 'object' },
            execute: vi.fn().mockResolvedValue({ ok: true }),
          },
        ]),
      );
    },
    async close() { /* noop */ },
  };
}

describe('McpHub', () => {
  let servers: McpServersRepo;
  let policies: McpToolPoliciesRepo;
  let hub: McpHub;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    servers = new McpServersRepo(db);
    policies = new McpToolPoliciesRepo(db);
    hub = new McpHub(servers, policies, {
      // Inject a fake transport factory so we don't actually spawn anything.
      createClient: async () => makeFakeClient(['list_files', 'read_file']) as any,
    });
  });

  it('eagerly connects on add and discovers tools', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    await hub.connect(id);
    const view = hub.getView(id)!;
    expect(view.status).toBe('connected');
    expect(view.tools.map((t) => t.name).sort()).toEqual(['list_files', 'read_file']);
    expect(view.tools.every((t) => t.policy === 'ask')).toBe(true);
  });

  it('respects per-tool policy overrides', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    policies.set(id, 'list_files', 'allow');
    await hub.connect(id);
    const view = hub.getView(id)!;
    expect(view.tools.find((t) => t.name === 'list_files')!.policy).toBe('allow');
    expect(view.tools.find((t) => t.name === 'read_file')!.policy).toBe('ask');
  });

  it('disable disconnects but preserves config', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    await hub.connect(id);
    await hub.disable(id);
    const view = hub.getView(id)!;
    expect(view.status).toBe('disabled');
    expect(view.tools).toEqual([]);
  });

  it('live update of defaultPolicy does not reconnect', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    await hub.connect(id);
    const before = hub.getView(id)!;
    servers.update(id, { defaultPolicy: 'allow' });
    await hub.refreshConfig(id);
    const after = hub.getView(id)!;
    expect(after.status).toBe('connected');
    expect(after.tools.every((t) => t.policy === 'allow')).toBe(true);
    expect(after).not.toBe(before);
  });

  it('toolsForChat returns only allow+ask tools, never deny', async () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    policies.set(id, 'list_files', 'deny');
    await hub.connect(id);
    const tools = hub.toolsForChat();
    expect(tools.map((t) => t.fullName)).toEqual([`${id}/read_file`]);
    expect(tools[0]!.needsApproval).toBe(true);  // 'ask'
  });
});
