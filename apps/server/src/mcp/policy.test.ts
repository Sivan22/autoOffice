import { describe, it, expect } from 'vitest';
import { mergePolicies } from './policy';

describe('mergePolicies', () => {
  it('returns each tool with the per-tool policy if set, else default', () => {
    const result = mergePolicies(
      [
        { name: 'a', description: 'A' },
        { name: 'b', description: null },
      ],
      'ask',
      { a: 'allow' },
    );
    expect(result).toEqual([
      { name: 'a', description: 'A', inputSchema: null, policy: 'allow' },
      { name: 'b', description: null, inputSchema: null, policy: 'ask' },
    ]);
  });
});
