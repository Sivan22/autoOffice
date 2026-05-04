import { describe, it, expect } from 'vitest';
import { isCliBridge, ProviderKindSchema, ProviderConfigSchema, CreateProviderInputSchema } from './provider';

describe('ProviderKindSchema', () => {
  it('accepts known kinds', () => {
    expect(ProviderKindSchema.parse('anthropic')).toBe('anthropic');
    expect(ProviderKindSchema.parse('claude-code')).toBe('claude-code');
  });

  it('rejects unknown kinds', () => {
    expect(() => ProviderKindSchema.parse('cohere')).toThrow();
  });

  it('isCliBridge identifies CLI kinds', () => {
    expect(isCliBridge('claude-code')).toBe(true);
    expect(isCliBridge('anthropic')).toBe(false);
  });
});

describe('CreateProviderInputSchema', () => {
  it('allows missing apiKey for CLI bridges', () => {
    const r = CreateProviderInputSchema.parse({ kind: 'claude-code', label: 'My Claude Code' });
    expect(r.kind).toBe('claude-code');
  });
});

describe('ProviderConfigSchema', () => {
  it('round-trips a sample row', () => {
    const sample = {
      id: 'p_1',
      kind: 'anthropic' as const,
      label: 'Anthropic Default',
      config: { baseUrl: 'https://api.anthropic.com' },
      hasKey: true,
      status: 'ready' as const,
      createdAt: 1,
      updatedAt: 1,
    };
    expect(ProviderConfigSchema.parse(sample)).toEqual(sample);
  });
});
