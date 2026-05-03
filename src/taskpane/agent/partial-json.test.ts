import { describe, it, expect } from 'vitest';
import { extractPartialStringField } from './partial-json.ts';

describe('extractPartialStringField', () => {
  it('returns null before the field appears', () => {
    expect(extractPartialStringField('{"', 'code')).toBe(null);
    expect(extractPartialStringField('{"co', 'code')).toBe(null);
    expect(extractPartialStringField('{', 'code')).toBe(null);
  });

  it('returns empty string when value just opened', () => {
    expect(extractPartialStringField('{"code":"', 'code')).toBe('');
  });

  it('returns the in-progress value mid-stream', () => {
    expect(extractPartialStringField('{"code":"const x', 'code')).toBe('const x');
  });

  it('decodes JSON escape sequences', () => {
    expect(extractPartialStringField('{"code":"a\\nb\\tc"', 'code')).toBe('a\nb\tc');
    expect(extractPartialStringField('{"code":"say \\"hi\\""', 'code')).toBe('say "hi"');
    expect(extractPartialStringField('{"code":"path\\\\file"', 'code')).toBe('path\\file');
  });

  it('decodes \\uXXXX escapes', () => {
    expect(extractPartialStringField('{"code":"\\u00e9"', 'code')).toBe('é');
  });

  it('tolerates truncation mid-escape', () => {
    expect(extractPartialStringField('{"code":"hello\\', 'code')).toBe('hello');
    expect(extractPartialStringField('{"code":"x\\u00', 'code')).toBe('x');
  });

  it('stops at the closing quote and ignores trailing JSON', () => {
    expect(extractPartialStringField('{"code":"hi","other":1}', 'code')).toBe('hi');
  });

  it('handles whitespace between key and value', () => {
    expect(extractPartialStringField('{ "code" : "abc"', 'code')).toBe('abc');
  });

  it('finds the requested field by name', () => {
    expect(extractPartialStringField('{"name":"x","code":"y"', 'code')).toBe('y');
  });
});
