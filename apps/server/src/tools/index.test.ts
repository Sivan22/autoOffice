import { describe, it, expect, vi } from 'vitest';
import { assembleTools } from './index';
import type { ChatToolWrapper } from '../mcp/hub';

describe('assembleTools', () => {
  function chatTool(name: string, needsApproval: boolean): ChatToolWrapper {
    return {
      fullName: `mcp_x/${name}`,
      description: name,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      needsApproval,
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };
  }

  it('includes built-ins (lookup_skill server-side, execute_code client-side)', () => {
    const out = assembleTools({ host: 'word', mcpTools: [] });
    expect(out).toHaveProperty('lookup_skill');
    expect(out).toHaveProperty('execute_code');
    expect(typeof (out.lookup_skill as any).execute).toBe('function');
    expect((out.execute_code as any).execute).toBeUndefined();
  });

  it('includes MCP tools using their fullName as key', () => {
    const t = chatTool('list_files', false);
    const out = assembleTools({ host: 'word', mcpTools: [t] });
    expect(out['mcp_x/list_files']).toBeDefined();
  });

  it('marks ask-policy tools with needsApproval', () => {
    const t = chatTool('list_files', true);
    const out = assembleTools({ host: 'word', mcpTools: [t] });
    expect((out['mcp_x/list_files'] as any).needsApproval).toBe(true);
  });
});
