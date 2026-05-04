import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { McpServersRepo, McpToolPoliciesRepo } from './mcp';

describe('McpServersRepo', () => {
  let servers: McpServersRepo;
  let policies: McpToolPoliciesRepo;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    servers = new McpServersRepo(db);
    policies = new McpToolPoliciesRepo(db);
  });

  it('round-trips a stdio server', () => {
    const id = servers.create({
      label: 'fs',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: ['fs.js'], env: {}, cwd: null },
    });
    const got = servers.get(id)!;
    expect(got).toMatchObject({ label: 'fs', transport: 'stdio', command: 'node', defaultPolicy: 'ask' });
    expect(got.args).toEqual(['fs.js']);
  });

  it('round-trips an http server', () => {
    const id = servers.create({
      label: 'remote',
      timeoutSeconds: 30,
      defaultPolicy: 'allow',
      disabled: false,
      spec: { transport: 'streamable-http', url: 'https://x.example/mcp', headers: { auth: 'tok' } },
    });
    const got = servers.get(id)!;
    expect(got.transport).toBe('streamable-http');
    expect(got.headers.auth).toBe('tok');
  });

  it('updates a single field', () => {
    const id = servers.create({
      label: 'a',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    servers.update(id, { timeoutSeconds: 120, defaultPolicy: 'allow' });
    const got = servers.get(id)!;
    expect(got.timeoutSeconds).toBe(120);
    expect(got.defaultPolicy).toBe('allow');
  });

  it('toggles disabled', () => {
    const id = servers.create({
      label: 'a',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    servers.setDisabled(id, true);
    expect(servers.get(id)!.disabled).toBe(true);
  });

  it('cascades policy delete', () => {
    const id = servers.create({
      label: 'a',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'node', args: [], env: {}, cwd: null },
    });
    policies.set(id, 't1', 'allow');
    servers.delete(id);
    expect(policies.get(id, 't1')).toBeNull();
  });
});

describe('McpToolPoliciesRepo', () => {
  let policies: McpToolPoliciesRepo;
  let servers: McpServersRepo;
  let serverId: string;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    servers = new McpServersRepo(db);
    policies = new McpToolPoliciesRepo(db);
    serverId = servers.create({
      label: 's',
      timeoutSeconds: 60,
      defaultPolicy: 'ask',
      disabled: false,
      spec: { transport: 'stdio', command: 'x', args: [], env: {}, cwd: null },
    });
  });

  it('upserts and reads', () => {
    policies.set(serverId, 'list_files', 'allow');
    expect(policies.get(serverId, 'list_files')).toBe('allow');
    policies.set(serverId, 'list_files', 'deny');
    expect(policies.get(serverId, 'list_files')).toBe('deny');
  });

  it('listForServer returns map of tool→policy', () => {
    policies.set(serverId, 'a', 'allow');
    policies.set(serverId, 'b', 'deny');
    const map = policies.listForServer(serverId);
    expect(map).toEqual({ a: 'allow', b: 'deny' });
  });
});
