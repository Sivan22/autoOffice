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

function sanitizeToolName(name: string): string {
  let s = name.replace(/[^a-zA-Z0-9_.\-:]/g, '_');
  if (!/^[a-zA-Z_]/.test(s)) s = '_' + s;
  return s.slice(0, 128);
}

export function assembleTools({ host, mcpTools }: AssembleArgs): ToolMap {
  const out: ToolMap = {
    lookup_skill: makeLookupSkillTool({ host }),
    execute_code: makeExecuteCodeTool(),
  };
  for (const m of mcpTools) {
    out[sanitizeToolName(m.fullName)] = tool({
      description: m.description ?? m.fullName,
      inputSchema: (m.inputSchema as any) ?? { type: 'object' },
      execute: async (input: unknown) => {
        try {
          return await m.execute(input);
        } catch (err) {
          return { error: (err as Error).message ?? String(err) };
        }
      },
      needsApproval: m.needsApproval,
    } as any);
  }
  return out;
}
