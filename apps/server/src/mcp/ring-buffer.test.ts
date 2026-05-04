import { describe, it, expect } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  it('keeps the last N entries', () => {
    const rb = new RingBuffer(3);
    rb.push('a');
    rb.push('b');
    rb.push('c');
    rb.push('d');
    expect(rb.toArray()).toEqual(['b', 'c', 'd']);
  });

  it('returns [] when empty', () => {
    expect(new RingBuffer(2).toArray()).toEqual([]);
  });

  it('lastErrorMatching returns most recent matching entry', () => {
    const rb = new RingBuffer(10);
    rb.push('hello');
    rb.push('Error: x');
    rb.push('Error: y');
    rb.push('ok');
    expect(rb.lastErrorMatching(/error/i)).toBe('Error: y');
  });
});
