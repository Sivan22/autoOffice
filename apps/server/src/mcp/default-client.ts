import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { StoredMcpServer } from '../db/mcp';
import type { McpClientLike } from './hub';

/**
 * Production MCP client factory. Tests inject a fake instead.
 *
 * Note (deviation from plan): the plan suggested importing `StdioClientTransport`
 * from `@modelcontextprotocol/sdk/client/stdio.js`. The installed `@ai-sdk/mcp@1.0.39`
 * exposes its own `Experimental_StdioMCPTransport` from `@ai-sdk/mcp/mcp-stdio`,
 * which is the one designed to satisfy the SDK's `MCPTransport` interface. We
 * use that here so the transport types match `createMCPClient` directly.
 */
export async function createDefaultClient(cfg: StoredMcpServer): Promise<McpClientLike> {
  const timeoutMs = cfg.timeoutSeconds * 1000;

  async function connect(): Promise<McpClientLike> {
    if (cfg.transport === 'stdio') {
      const transport = new Experimental_StdioMCPTransport({
        command: cfg.command!,
        args: cfg.args,
        cwd: cfg.cwd ?? undefined,
        env: { ...(process.env as Record<string, string>), ...cfg.env },
      });
      return wrap(await createMCPClient({ transport }));
    }
    if (cfg.transport === 'sse') {
      return wrap(await createMCPClient({
        transport: { type: 'sse', url: cfg.url!, headers: cfg.headers },
      }));
    }
    return wrap(await createMCPClient({
      transport: { type: 'http', url: cfg.url!, headers: cfg.headers },
    }));
  }

  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`MCP connection timed out after ${cfg.timeoutSeconds}s`)), timeoutMs),
  );

  return Promise.race([connect(), deadline]);
}

function wrap(client: {
  tools: () => Promise<Record<string, { description?: string; inputSchema?: unknown; execute?: (args: unknown) => Promise<unknown> }>>;
  close: () => Promise<void>;
}): McpClientLike {
  return {
    async tools() {
      return await client.tools();
    },
    async close() {
      await client.close();
    },
  };
}
