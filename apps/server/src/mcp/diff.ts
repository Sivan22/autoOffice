import type { StoredMcpServer } from '../db/mcp';

export type ChangeKind = 'none' | 'live' | 'restart' | 'enable' | 'disable';

const RESTART_FIELDS: ReadonlyArray<keyof StoredMcpServer> = [
  'transport',
  'command',
  'args',
  'cwd',
  'env',
  'url',
  'headers',
  'timeoutSeconds',
];

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function classifyChange(prev: StoredMcpServer, next: StoredMcpServer): ChangeKind {
  if (prev.disabled !== next.disabled) {
    return next.disabled ? 'disable' : 'enable';
  }
  for (const f of RESTART_FIELDS) {
    if (!deepEqual(prev[f], next[f])) return 'restart';
  }
  if (
    prev.label !== next.label ||
    prev.defaultPolicy !== next.defaultPolicy
  ) {
    return 'live';
  }
  return 'none';
}
