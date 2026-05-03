import { describe, it, expect } from 'vitest';
import { formatError, ConfigError } from './errors.ts';

describe('formatError — fallback', () => {
  it('handles a plain Error', () => {
    const out = formatError(new Error('boom'));
    expect(out.kind).toBe('unknown');
    expect(out.title).toBe('Unexpected error');
    expect(out.detail).toBe('boom');
    expect(out.raw).toContain('boom');
  });

  it('handles a non-Error throw (string)', () => {
    const out = formatError('weird');
    expect(out.kind).toBe('unknown');
    expect(out.detail).toBe('weird');
  });

  it('handles null/undefined', () => {
    const out = formatError(undefined);
    expect(out.kind).toBe('unknown');
    expect(out.detail).toBe('Unknown error');
  });
});

describe('formatError — ConfigError', () => {
  it('classifies ConfigError as kind=config', () => {
    const out = formatError(new ConfigError('No API key configured for Anthropic.'));
    expect(out.kind).toBe('config');
    expect(out.title).toBe('Configuration error');
    expect(out.detail).toBe('No API key configured for Anthropic.');
  });
});
