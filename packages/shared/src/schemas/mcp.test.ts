import { describe, it, expect } from 'vitest';
import { CreateMcpServerInputSchema, McpServerInputSchema } from './mcp';

describe('McpServerInputSchema (discriminated union)', () => {
  it('accepts a stdio config', () => {
    const r = McpServerInputSchema.parse({ transport: 'stdio', command: 'node', args: ['server.js'] });
    expect(r.transport).toBe('stdio');
  });

  it('accepts a streamable-http config', () => {
    const r = McpServerInputSchema.parse({
      transport: 'streamable-http',
      url: 'https://x.example/mcp',
    });
    expect(r.transport).toBe('streamable-http');
  });

  it('rejects mixing fields', () => {
    expect(() =>
      McpServerInputSchema.parse({ transport: 'stdio', url: 'https://no.example' }),
    ).toThrow();
  });
});

describe('CreateMcpServerInputSchema', () => {
  it('applies defaults', () => {
    const r = CreateMcpServerInputSchema.parse({
      label: 'fs',
      spec: { transport: 'stdio', command: 'node', args: [] },
    });
    expect(r.timeoutSeconds).toBe(60);
    expect(r.defaultPolicy).toBe('ask');
    expect(r.disabled).toBe(false);
  });
});
