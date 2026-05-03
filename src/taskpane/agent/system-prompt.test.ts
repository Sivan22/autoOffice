import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './system-prompt.ts';

describe('buildSystemPrompt', () => {
  it('contains an English-locale clause naming "English"', () => {
    const p = buildSystemPrompt('word', ['document'], 'en');
    expect(p).toMatch(/respond to the user in \*\*English\*\* \(en\)/i);
  });

  it('contains a Hebrew-locale clause naming the native name', () => {
    const p = buildSystemPrompt('word', ['document'], 'he');
    expect(p).toMatch(/respond to the user in \*\*עברית\*\* \(he\)/i);
  });

  it('keeps locale clause near the end of the prompt', () => {
    const p = buildSystemPrompt('word', ['document'], 'he');
    const idx = p.toLowerCase().indexOf('respond to the user');
    expect(idx).toBeGreaterThan(p.length / 2);
  });

  it('still includes the office.js critical rules', () => {
    const p = buildSystemPrompt('word', ['document'], 'en');
    expect(p).toContain('CRITICAL RULES for office.js code');
  });
});
