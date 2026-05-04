import type { McpPolicy, McpToolDescriptor } from '@autooffice/shared';

export type DiscoveredTool = {
  name: string;
  description?: string | null;
  inputSchema?: unknown;
};

export function mergePolicies(
  discovered: DiscoveredTool[],
  defaultPolicy: McpPolicy,
  perTool: Record<string, McpPolicy>,
): McpToolDescriptor[] {
  return discovered.map((t) => ({
    name: t.name,
    description: t.description ?? null,
    inputSchema: t.inputSchema ?? null,
    policy: perTool[t.name] ?? defaultPolicy,
  }));
}
