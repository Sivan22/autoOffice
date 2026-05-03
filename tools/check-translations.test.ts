import { describe, it, expect } from 'vitest';
import { diffKeys, flattenKeys } from './check-translations.ts';

describe('check-translations', () => {
  it('flattenKeys returns all leaf paths, depth-first', () => {
    expect(flattenKeys({ a: { b: 'x', c: 'y' }, d: 'z' }).sort())
      .toEqual(['a.b', 'a.c', 'd']);
  });

  it('diffKeys reports missing and extra', () => {
    const en = { common: { a: '1', b: '2' } };
    const he = { common: { a: '1', c: '3' } };
    const { missing, extra } = diffKeys(en, he);
    expect(missing).toEqual(['common.b']);
    expect(extra).toEqual(['common.c']);
  });
});
