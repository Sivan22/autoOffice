import { describe, it, expect, vi } from 'vitest';
import { makeOnToolCall } from './on-tool-call';

describe('makeOnToolCall', () => {
  it('runs execute_code immediately when autoApprove is true', async () => {
    const runInIframe = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => true,
    });
    await handler({
      toolCall: { toolName: 'execute_code', toolCallId: 'tc1', input: { code: 'x' }, dynamic: false },
    } as any);
    expect(runInIframe).toHaveBeenCalledWith('x');
    expect(addToolOutput).toHaveBeenCalledWith({
      tool: 'execute_code',
      toolCallId: 'tc1',
      output: { ok: true, value: 42 },
    });
  });

  it('does NOT run execute_code when autoApprove is false', async () => {
    const runInIframe = vi.fn();
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => false,
    });
    await handler({
      toolCall: { toolName: 'execute_code', toolCallId: 'tc1', input: { code: 'x' }, dynamic: false },
    } as any);
    expect(runInIframe).not.toHaveBeenCalled();
    expect(addToolOutput).not.toHaveBeenCalled();
  });

  it('skips dynamic tool calls (server-handled MCP)', async () => {
    const runInIframe = vi.fn();
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => true,
    });
    await handler({
      toolCall: { toolName: 'mcp_x/list', toolCallId: 'tc1', input: {}, dynamic: true },
    } as any);
    expect(runInIframe).not.toHaveBeenCalled();
  });

  it('reports output-error on iframe throw', async () => {
    const runInIframe = vi.fn().mockRejectedValue(new Error('boom'));
    const addToolOutput = vi.fn();
    const handler = makeOnToolCall({
      runInIframe,
      addToolOutput,
      isAutoApprove: () => true,
    });
    await handler({
      toolCall: { toolName: 'execute_code', toolCallId: 'tc1', input: { code: 'x' }, dynamic: false },
    } as any);
    expect(addToolOutput).toHaveBeenCalledWith(expect.objectContaining({ state: 'output-error' }));
  });
});
