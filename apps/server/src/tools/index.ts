import { tool, type Tool } from 'ai';
import type { Host } from '@autooffice/shared';
import type { ChatToolWrapper } from '../mcp/hub';
import { makeLookupSkillTool } from './lookup_skill';
import { makeExecuteCodeTool } from './execute_code';

type ToolMap = Record<string, Tool<any, any>>;

export type AssembleArgs = {
  host: Host;
  mcpTools: ChatToolWrapper[];
};

export function assembleTools({ host, mcpTools }: AssembleArgs): ToolMap {
  const out: ToolMap = {
    lookup_skill: makeLookupSkillTool({ host }),
    execute_code: makeExecuteCodeTool(),
  };
  for (const m of mcpTools) {
    out[m.fullName] = tool({
      description: m.description ?? m.fullName,
      inputSchema: (m.inputSchema as any) ?? { type: 'object' },
      execute: async (input: unknown) => m.execute(input),
      needsApproval: m.needsApproval,
    } as any);
  }
  return out;
}
