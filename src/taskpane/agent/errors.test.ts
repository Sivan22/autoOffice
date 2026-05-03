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

describe('formatError — AI SDK APICallError', () => {
  function makeApiError(extras: Record<string, unknown>): Error {
    const e = new Error('API call failed');
    e.name = 'AI_APICallError';
    Object.assign(e, extras);
    return e;
  }

  it('extracts statusCode and parsed responseBody.error.message', () => {
    const err = makeApiError({
      statusCode: 401,
      url: 'https://api.anthropic.com/v1/messages',
      responseBody: JSON.stringify({ error: { message: 'invalid x-api-key' } }),
    });
    const out = formatError(err, { provider: 'Anthropic' });
    expect(out.kind).toBe('api');
    expect(out.title).toBe('Anthropic API error (401)');
    expect(out.detail).toBe('invalid x-api-key');
    expect(out.raw).toContain('401');
    expect(out.raw).toContain('invalid x-api-key');
  });

  it('falls back to raw responseBody when not JSON', () => {
    const err = makeApiError({ statusCode: 500, responseBody: 'gateway down' });
    const out = formatError(err, { provider: 'OpenAI' });
    expect(out.title).toBe('OpenAI API error (500)');
    expect(out.detail).toBe('gateway down');
  });

  it('omits provider name when ctx has none', () => {
    const err = makeApiError({ statusCode: 429 });
    const out = formatError(err);
    expect(out.title).toBe('API error (429)');
  });

  it('detects via duck-typing when name is missing', () => {
    const err = new Error('failed');
    Object.assign(err, { statusCode: 403, responseBody: '{}' });
    const out = formatError(err, { provider: 'Groq' });
    expect(out.kind).toBe('api');
    expect(out.title).toBe('Groq API error (403)');
  });
});

describe('formatError — AI SDK config-shaped errors', () => {
  it('classifies AI_LoadAPIKeyError as kind=config', () => {
    const err = new Error('GROQ_API_KEY env var not set');
    err.name = 'AI_LoadAPIKeyError';
    const out = formatError(err);
    expect(out.kind).toBe('config');
    expect(out.title).toBe('Configuration error');
  });

  it('classifies AI_NoSuchModelError as kind=config', () => {
    const err = new Error('Model bogus-1 not found');
    err.name = 'AI_NoSuchModelError';
    const out = formatError(err);
    expect(out.kind).toBe('config');
  });
});

describe('formatError — AI SDK API-shaped errors (non-call)', () => {
  it('classifies AI_NoContentGeneratedError as kind=api', () => {
    const err = new Error('No content generated');
    err.name = 'AI_NoContentGeneratedError';
    const out = formatError(err, { provider: 'OpenAI', model: 'gpt-5' });
    expect(out.kind).toBe('api');
    expect(out.title).toBe('OpenAI returned no content');
  });

  it('classifies AI_NoOutputGeneratedError as kind=api (not "Unexpected error")', () => {
    const err = new Error('No output generated. Check the stream for errors.');
    err.name = 'AI_NoOutputGeneratedError';
    const out = formatError(err, { provider: 'Anthropic', model: 'claude-opus-4-7' });
    expect(out.kind).toBe('api');
    expect(out.title).not.toBe('Unexpected error');
    expect(out.title).toContain('Anthropic');
    expect(out.detail).toContain('No output generated');
  });
});

describe('formatError — OfficeExtension.Error', () => {
  it('extracts code, errorLocation, statement', () => {
    const err = new Error('A property on this object was not loaded');
    Object.assign(err, {
      code: 'PropertyNotLoaded',
      debugInfo: {
        code: 'PropertyNotLoaded',
        message: 'The property "text" is not available.',
        errorLocation: 'Paragraph.text',
        statement: 'paragraph.text',
        surroundingStatements: ['paragraph.load(\'style\')', 'paragraph.text'],
        fullStatements: [],
      },
    });
    const out = formatError(err);
    expect(out.kind).toBe('office');
    expect(out.title).toBe('Office.js error: PropertyNotLoaded');
    expect(out.detail).toContain('The property "text" is not available.');
    expect(out.detail).toContain('Paragraph.text');
    expect(out.raw).toContain('surroundingStatements');
  });
});

describe('formatError — network', () => {
  it('classifies "Failed to fetch" TypeError', () => {
    const err = new TypeError('Failed to fetch');
    const out = formatError(err);
    expect(out.kind).toBe('network');
    expect(out.title).toBe('Network error');
    expect(out.detail).toBe('Failed to fetch');
  });

  it('classifies AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    const out = formatError(err);
    expect(out.kind).toBe('network');
    expect(out.title).toBe('Request cancelled');
  });
});

describe('formatError — MCP', () => {
  it('uses ctx.serverName in title when phase is mcp-connect', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:9000');
    const out = formatError(err, { phase: 'mcp-connect', serverName: 'sefaria' });
    expect(out.kind).toBe('mcp');
    expect(out.title).toBe('MCP server "sefaria" unreachable');
    expect(out.detail).toContain('ECONNREFUSED');
  });
});
