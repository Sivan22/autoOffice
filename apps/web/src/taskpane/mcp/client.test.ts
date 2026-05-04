import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMCPClient: vi.fn(),
}));

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: mocks.createMCPClient,
}));

import { getMcpTools } from './client.ts';
import type { McpServerConfig } from '../store/settings.ts';

const goodServer: McpServerConfig = {
  name: 'good', url: 'https://good.example/mcp', enabled: true, transport: 'streamable-http',
};
const badServer: McpServerConfig = {
  name: 'bad', url: 'https://bad.example/mcp', enabled: true, transport: 'streamable-http',
};

describe('getMcpTools', () => {
  beforeEach(() => mocks.createMCPClient.mockReset());

  it('returns connected server tools and collects failures', async () => {
    mocks.createMCPClient.mockImplementation((arg: unknown) => {
      const url = (arg as { transport: { url: string } } | undefined)?.transport.url ?? '';
      if (url.includes('bad')) return Promise.reject(new Error('ECONNREFUSED'));
      return Promise.resolve({ tools: () => Promise.resolve({ search: { description: 'x' } }) });
    });
    const result = await getMcpTools([goodServer, badServer]);
    expect(Object.keys(result.tools)).toEqual(['search']);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].serverName).toBe('bad');
    expect((result.failures[0].error as Error).message).toBe('ECONNREFUSED');
  });

  it('skips disabled and url-less servers', async () => {
    const result = await getMcpTools([
      { name: 'off',  url: 'https://example/mcp', enabled: false, transport: 'streamable-http' },
      { name: 'none', url: '',                    enabled: true,  transport: 'streamable-http' },
    ]);
    expect(result.tools).toEqual({});
    expect(result.failures).toEqual([]);
    expect(mocks.createMCPClient).not.toHaveBeenCalled();
  });
});
