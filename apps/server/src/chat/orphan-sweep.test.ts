import { describe, it, expect } from 'vitest';
import { sweepOrphans } from './orphan-sweep';

describe('sweepOrphans', () => {
  it('passes through messages with no tool calls unchanged', () => {
    const msgs = [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }];
    expect(sweepOrphans(msgs as any)).toEqual(msgs);
  });

  it('injects synthetic output for an assistant tool-call without a matching tool-result', () => {
    const msgs = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Calling tool' },
          {
            type: 'tool-execute_code',
            toolCallId: 'tc1',
            state: 'input-available',
            input: { code: 'x' },
          },
        ],
      },
    ];
    const out = sweepOrphans(msgs as any);
    const last = out[0]!.parts;
    expect(last).toHaveLength(2);
    expect((last[1] as any).state).toBe('output-error');
    expect((last[1] as any).errorText).toMatch(/not recorded/i);
  });

  it('leaves a tool-call alone when a matching output-available exists', () => {
    const msgs = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-execute_code',
            toolCallId: 'tc1',
            state: 'output-available',
            input: { code: 'x' },
            output: { ok: true },
          },
        ],
      },
    ];
    expect(sweepOrphans(msgs as any)).toEqual(msgs);
  });

  it('heals an aborted previous turn (tool-call still in input-streaming state)', () => {
    const msgs = [
      {
        id: 'm0',
        role: 'user',
        parts: [{ type: 'text', text: 'do thing' }],
      },
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Working on it' },
          {
            type: 'tool-execute_code',
            toolCallId: 'tc-aborted',
            state: 'input-streaming',
            input: { code: 'await context.sync()' },
          },
        ],
      },
    ];
    const out = sweepOrphans(msgs as any);
    expect(out).toHaveLength(2);
    const sweptPart = out[1]!.parts[1] as any;
    expect(sweptPart.state).toBe('output-error');
    expect(sweptPart.errorText).toMatch(/not recorded/i);
    // first user message untouched
    expect(out[0]).toEqual(msgs[0]);
  });

  it('heals dangling dynamic-tool parts', () => {
    const msgs = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'mcp_x/list',
            toolCallId: 'tcd',
            state: 'input-available',
            input: {},
          },
        ],
      },
    ];
    const out = sweepOrphans(msgs as any);
    expect((out[0]!.parts[0] as any).state).toBe('output-error');
  });

  it('leaves output-error parts alone (terminal state)', () => {
    const msgs = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-execute_code',
            toolCallId: 'tc1',
            state: 'output-error',
            errorText: 'previous failure',
          },
        ],
      },
    ];
    expect(sweepOrphans(msgs as any)).toEqual(msgs);
  });
});
