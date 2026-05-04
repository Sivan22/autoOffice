import { describe, it, expect, beforeEach } from 'vitest';

describe('vitest infrastructure', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('runs in jsdom and has localStorage', () => {
    localStorage.setItem('k', 'v');
    expect(localStorage.getItem('k')).toBe('v');
  });

  it('has crypto.randomUUID', () => {
    const id = crypto.randomUUID();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
