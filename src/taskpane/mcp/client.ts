import { experimental_createMCPClient as createMCPClient } from 'ai';
import type { McpServerConfig } from '../store/settings.ts';
import type { ToolSet } from 'ai';

export async function getMcpTools(servers: McpServerConfig[]): Promise<ToolSet> {
  const allTools: ToolSet = {};

  const enabledServers = servers.filter(s => s.enabled && s.url);

  for (const server of enabledServers) {
    try {
      const client = await createMCPClient({
        transport: {
          type: server.transport === 'sse' ? 'sse' : 'sse',
          url: server.url,
        },
      });

      const tools = await client.tools();
      Object.assign(allTools, tools);
    } catch (e) {
      console.warn(`Failed to connect to MCP server "${server.name}":`, e);
    }
  }

  return allTools;
}
