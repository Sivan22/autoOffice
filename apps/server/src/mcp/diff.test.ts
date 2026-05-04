import { describe, it, expect } from 'vitest';
import type { StoredMcpServer } from '../db/mcp';
import { classifyChange } from './diff';

const base: StoredMcpServer = {
  id: 'mcp_1',
  label: 'fs',
  transport: 'stdio',
  command: 'node',
  args: ['fs.js'],
  cwd: null,
  env: {},
  url: null,
  headers: {},
  timeoutSeconds: 60,
  defaultPolicy: 'ask',
  disabled: false,
  createdAt: 1,
  updatedAt: 1,
};

describe('classifyChange', () => {
  it('returns "none" when nothing relevant changed', () => {
    expect(classifyChange(base, { ...base, updatedAt: 2 })).toBe('none');
  });

  it('returns "live" for label / timeout / defaultPolicy', () => {
    expect(classifyChange(base, { ...base, label: 'fs2' })).toBe('live');
    expect(classifyChange(base, { ...base, timeoutSeconds: 120 })).toBe('live');
    expect(classifyChange(base, { ...base, defaultPolicy: 'allow' })).toBe('live');
  });

  it('returns "restart" for transport-affecting fields', () => {
    expect(classifyChange(base, { ...base, command: 'bun' })).toBe('restart');
    expect(classifyChange(base, { ...base, args: ['fs.js', '-v'] })).toBe('restart');
    expect(classifyChange(base, { ...base, cwd: '/tmp' })).toBe('restart');
    expect(classifyChange(base, { ...base, env: { K: 'v' } })).toBe('restart');
    expect(classifyChange(base, { ...base, transport: 'streamable-http', command: null, url: 'https://x' })).toBe('restart');
    expect(classifyChange(base, {
      ...base,
      transport: 'streamable-http',
      command: null,
      url: 'https://x',
      headers: { a: '1' },
    })).toBe('restart');
  });

  it('returns "disable" / "enable" appropriately', () => {
    expect(classifyChange(base, { ...base, disabled: true })).toBe('disable');
    expect(classifyChange({ ...base, disabled: true }, base)).toBe('enable');
  });
});
