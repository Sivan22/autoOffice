import type {
  McpServerView,
  McpStatus,
  McpToolDescriptor,
} from '@autooffice/shared';
import type { McpServersRepo, McpToolPoliciesRepo, StoredMcpServer } from '../db/mcp';
import { mergePolicies, type DiscoveredTool } from './policy';
import { RingBuffer } from './ring-buffer';
import { mcpEvents } from './events';
import { classifyChange } from './diff';

export type McpClientLike = {
  tools(): Promise<Record<string, { description?: string; inputSchema?: unknown; execute?: (args: unknown) => Promise<unknown> }>>;
  close(): Promise<void>;
};

export type CreateClientFn = (cfg: StoredMcpServer) => Promise<McpClientLike>;

export type ChatToolWrapper = {
  fullName: string;       // e.g. "mcp_xyz/list_files" — used as the tool key in streamText({ tools })
  description: string | null;
  inputSchema: unknown;
  needsApproval: boolean; // true for 'ask'
  execute: (args: unknown) => Promise<unknown>;
};

type ManagedConnection = {
  serverId: string;
  client: McpClientLike | null;
  status: McpStatus;
  errorMessage: string | null;
  tools: McpToolDescriptor[];
  rawTools: DiscoveredTool[];
  rawClientTools: Record<string, { execute?: (args: unknown) => Promise<unknown> }>;
  stderr: RingBuffer;
  prevConfig: StoredMcpServer | null;
};

export class McpHub {
  private connections = new Map<string, ManagedConnection>();

  constructor(
    private readonly servers: McpServersRepo,
    private readonly policies: McpToolPoliciesRepo,
    private readonly opts: { createClient: CreateClientFn },
  ) {}

  async startAll(): Promise<void> {
    for (const s of this.servers.list()) {
      if (!s.disabled) {
        try {
          await this.connect(s.id);
        } catch (err) {
          this.markError(s.id, (err as Error).message);
        }
      } else {
        this.connections.set(s.id, this.makeDisabledConnection(s));
        this.emit(s.id);
      }
    }
  }

  async connect(serverId: string): Promise<void> {
    const cfg = this.servers.get(serverId);
    if (!cfg) throw new Error('server not found');
    let conn = this.connections.get(serverId);
    if (!conn) {
      conn = {
        serverId,
        client: null,
        status: 'connecting',
        errorMessage: null,
        tools: [],
        rawTools: [],
        rawClientTools: {},
        stderr: new RingBuffer(100),
        prevConfig: cfg,
      };
      this.connections.set(serverId, conn);
    } else {
      conn.status = 'connecting';
      conn.errorMessage = null;
      conn.prevConfig = cfg;
    }
    this.emit(serverId);

    try {
      const client = await this.opts.createClient(cfg);
      const rawTools = await client.tools();
      conn.client = client;
      conn.rawClientTools = rawTools;
      const discovered: DiscoveredTool[] = Object.entries(rawTools).map(([name, t]) => ({
        name,
        description: t.description ?? null,
        inputSchema: t.inputSchema ?? null,
      }));
      conn.rawTools = discovered;
      conn.status = 'connected';
      conn.errorMessage = null;
      conn.tools = mergePolicies(discovered, cfg.defaultPolicy, this.policies.listForServer(serverId));
      this.emit(serverId);
    } catch (err) {
      this.markError(serverId, (err as Error).message);
      throw err;
    }
  }

  async disable(serverId: string): Promise<void> {
    await this.tearDown(serverId);
    const cfg = this.servers.get(serverId);
    const conn = cfg ? this.makeDisabledConnection(cfg) : null;
    if (conn) this.connections.set(serverId, conn);
    this.emit(serverId);
  }

  async enable(serverId: string): Promise<void> {
    return this.connect(serverId);
  }

  async refreshConfig(serverId: string): Promise<void> {
    const next = this.servers.get(serverId);
    if (!next) return this.tearDown(serverId);
    const conn = this.connections.get(serverId);
    const prev = conn?.prevConfig ?? null;
    const change = prev ? classifyChange(prev, next) : 'restart';
    switch (change) {
      case 'none':
        return;
      case 'live':
        if (conn) {
          conn.tools = mergePolicies(
            conn.rawTools,
            next.defaultPolicy,
            this.policies.listForServer(serverId),
          );
          conn.prevConfig = next;
          this.emit(serverId);
        }
        return;
      case 'enable':
        return this.connect(serverId);
      case 'disable':
        return this.disable(serverId);
      case 'restart':
        await this.tearDown(serverId);
        return this.connect(serverId);
    }
  }

  async refreshPolicies(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    const cfg = this.servers.get(serverId);
    if (!cfg) return;
    conn.tools = mergePolicies(conn.rawTools, cfg.defaultPolicy, this.policies.listForServer(serverId));
    this.emit(serverId);
  }

  async remove(serverId: string): Promise<void> {
    await this.tearDown(serverId);
    this.connections.delete(serverId);
  }

  getView(serverId: string): McpServerView | null {
    const cfg = this.servers.get(serverId);
    if (!cfg) return null;
    const conn = this.connections.get(serverId);
    return {
      id: cfg.id,
      label: cfg.label,
      transport: cfg.transport,
      command: cfg.command,
      args: cfg.args,
      cwd: cfg.cwd,
      env: cfg.env,
      url: cfg.url,
      headers: cfg.headers,
      timeoutSeconds: cfg.timeoutSeconds,
      defaultPolicy: cfg.defaultPolicy,
      disabled: cfg.disabled,
      status: conn?.status ?? (cfg.disabled ? 'disabled' : 'disconnected'),
      errorMessage: conn?.errorMessage ?? null,
      tools: conn?.tools ?? [],
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
    };
  }

  listViews(): McpServerView[] {
    return this.servers.list().map((s) => this.getView(s.id)!).filter(Boolean);
  }

  getStderrLog(serverId: string): string[] {
    return this.connections.get(serverId)?.stderr.toArray() ?? [];
  }

  toolsForChat(): ChatToolWrapper[] {
    const out: ChatToolWrapper[] = [];
    for (const conn of this.connections.values()) {
      if (conn.status !== 'connected') continue;
      for (const t of conn.tools) {
        if (t.policy === 'deny') continue;
        const cliEntry = conn.rawClientTools[t.name];
        out.push({
          fullName: `${conn.serverId}/${t.name}`,
          description: t.description ?? null,
          inputSchema: t.inputSchema,
          needsApproval: t.policy === 'ask',
          execute: cliEntry?.execute ?? (async () => {
            throw new Error(`Tool ${t.name} has no execute fn`);
          }),
        });
      }
    }
    return out;
  }

  private async tearDown(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    if (conn.client) {
      try { await conn.client.close(); } catch { /* noop */ }
    }
    conn.client = null;
    conn.rawTools = [];
    conn.rawClientTools = {};
    conn.tools = [];
    conn.status = 'disconnected';
    this.emit(serverId);
  }

  private makeDisabledConnection(cfg: StoredMcpServer): ManagedConnection {
    return {
      serverId: cfg.id,
      client: null,
      status: 'disabled',
      errorMessage: null,
      tools: [],
      rawTools: [],
      rawClientTools: {},
      stderr: new RingBuffer(100),
      prevConfig: cfg,
    };
  }

  private markError(serverId: string, message: string) {
    const conn = this.connections.get(serverId);
    if (!conn) return;
    conn.status = 'error';
    conn.errorMessage = message;
    this.emit(serverId);
  }

  private emit(serverId: string) {
    const view = this.getView(serverId);
    if (!view) return;
    mcpEvents.emitStatus({
      serverId,
      status: view.status,
      errorMessage: view.errorMessage,
      toolCount: view.tools.length,
    });
  }
}
