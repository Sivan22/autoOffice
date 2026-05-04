import type { Database } from 'bun:sqlite';
import {
  CreateMcpServerInputSchema,
  type CreateMcpServerInput,
  type UpdateMcpServerInput,
  type McpPolicy,
  type McpTransport,
  newId,
} from '@autooffice/shared';

type Row = {
  id: string;
  label: string;
  transport: string;
  command: string | null;
  args: string;
  cwd: string | null;
  env: string;
  url: string | null;
  headers: string;
  timeout_seconds: number;
  default_policy: string;
  disabled: number;
  created_at: number;
  updated_at: number;
};

export type StoredMcpServer = {
  id: string;
  label: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  cwd: string | null;
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  timeoutSeconds: number;
  defaultPolicy: McpPolicy;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
};

function rowToStored(row: Row): StoredMcpServer {
  return {
    id: row.id,
    label: row.label,
    transport: row.transport as McpTransport,
    command: row.command,
    args: JSON.parse(row.args || '[]'),
    cwd: row.cwd,
    env: JSON.parse(row.env || '{}'),
    url: row.url,
    headers: JSON.parse(row.headers || '{}'),
    timeoutSeconds: row.timeout_seconds,
    defaultPolicy: row.default_policy as McpPolicy,
    disabled: !!row.disabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class McpServersRepo {
  constructor(private readonly db: Database) {}

  create(input: CreateMcpServerInput): string {
    const parsed = CreateMcpServerInputSchema.parse(input);
    const id = newId('mcp');
    const now = Date.now();
    const isStdio = parsed.spec.transport === 'stdio';
    const command = isStdio ? parsed.spec.command : null;
    const args = isStdio ? parsed.spec.args : [];
    const cwd = isStdio ? parsed.spec.cwd ?? null : null;
    const env = isStdio ? parsed.spec.env : {};
    const url = !isStdio ? parsed.spec.url : null;
    const headers = !isStdio ? parsed.spec.headers : {};
    this.db
      .prepare(
        `INSERT INTO mcp_servers (id, label, transport, command, args, cwd, env, url, headers, timeout_seconds, default_policy, disabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        parsed.label,
        parsed.spec.transport,
        command,
        JSON.stringify(args),
        cwd,
        JSON.stringify(env),
        url,
        JSON.stringify(headers),
        parsed.timeoutSeconds,
        parsed.defaultPolicy,
        parsed.disabled ? 1 : 0,
        now,
        now,
      );
    return id;
  }

  update(id: string, patch: UpdateMcpServerInput): void {
    const cur = this.get(id);
    if (!cur) throw new Error('not found');
    const merged: StoredMcpServer = {
      ...cur,
      label: patch.label ?? cur.label,
      timeoutSeconds: patch.timeoutSeconds ?? cur.timeoutSeconds,
      defaultPolicy: patch.defaultPolicy ?? cur.defaultPolicy,
      disabled: patch.disabled ?? cur.disabled,
    };
    if (patch.spec) {
      merged.transport = patch.spec.transport;
      if (patch.spec.transport === 'stdio') {
        merged.command = patch.spec.command;
        merged.args = patch.spec.args;
        merged.cwd = patch.spec.cwd ?? null;
        merged.env = patch.spec.env;
        merged.url = null;
        merged.headers = {};
      } else {
        merged.command = null;
        merged.args = [];
        merged.cwd = null;
        merged.env = {};
        merged.url = patch.spec.url;
        merged.headers = patch.spec.headers;
      }
    }
    this.db
      .prepare(
        `UPDATE mcp_servers SET label=?, transport=?, command=?, args=?, cwd=?, env=?, url=?, headers=?, timeout_seconds=?, default_policy=?, disabled=?, updated_at=? WHERE id=?`,
      )
      .run(
        merged.label,
        merged.transport,
        merged.command,
        JSON.stringify(merged.args),
        merged.cwd,
        JSON.stringify(merged.env),
        merged.url,
        JSON.stringify(merged.headers),
        merged.timeoutSeconds,
        merged.defaultPolicy,
        merged.disabled ? 1 : 0,
        Date.now(),
        id,
      );
  }

  setDisabled(id: string, disabled: boolean): void {
    this.db
      .prepare('UPDATE mcp_servers SET disabled = ?, updated_at = ? WHERE id = ?')
      .run(disabled ? 1 : 0, Date.now(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
  }

  get(id: string): StoredMcpServer | null {
    const row = this.db
      .query<Row, [string]>('SELECT * FROM mcp_servers WHERE id = ?')
      .get(id);
    return row ? rowToStored(row) : null;
  }

  list(): StoredMcpServer[] {
    return (
      this.db
        .query<Row, []>('SELECT * FROM mcp_servers ORDER BY created_at ASC')
        .all()
        .map(rowToStored)
    );
  }
}

export class McpToolPoliciesRepo {
  constructor(private readonly db: Database) {}

  set(serverId: string, toolName: string, policy: McpPolicy): void {
    this.db
      .prepare(
        `INSERT INTO mcp_tool_policies (server_id, tool_name, policy) VALUES (?, ?, ?)
         ON CONFLICT(server_id, tool_name) DO UPDATE SET policy = excluded.policy`,
      )
      .run(serverId, toolName, policy);
  }

  get(serverId: string, toolName: string): McpPolicy | null {
    const row = this.db
      .query<{ policy: string }, [string, string]>(
        'SELECT policy FROM mcp_tool_policies WHERE server_id = ? AND tool_name = ?',
      )
      .get(serverId, toolName);
    return (row?.policy as McpPolicy | undefined) ?? null;
  }

  listForServer(serverId: string): Record<string, McpPolicy> {
    const rows = this.db
      .query<{ tool_name: string; policy: string }, [string]>(
        'SELECT tool_name, policy FROM mcp_tool_policies WHERE server_id = ?',
      )
      .all(serverId);
    return Object.fromEntries(rows.map((r) => [r.tool_name, r.policy as McpPolicy]));
  }
}
