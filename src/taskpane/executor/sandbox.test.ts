import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Sandbox } from './sandbox.ts';

describe('Sandbox.execute — Office.js debug info', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).Word = {
      run: async (fn: (ctx: unknown) => Promise<unknown>) => {
        const officeError = new Error('A property on this object was not loaded');
        Object.assign(officeError, {
          code: 'PropertyNotLoaded',
          debugInfo: {
            code: 'PropertyNotLoaded',
            message: 'The property "text" is not available.',
            errorLocation: 'Paragraph.text',
            statement: 'paragraph.text',
            surroundingStatements: ['paragraph.load("style")', 'paragraph.text'],
            fullStatements: [],
          },
        });
        await fn({});
        throw officeError;
      },
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).Word;
  });

  it('captures debugInfo on OfficeExtension.Error', async () => {
    const sandbox = new Sandbox('word');
    sandbox.init();
    const result = await sandbox.execute('return 1;');
    expect(result.success).toBe(false);
    expect(result.error).toContain('PropertyNotLoaded');
    expect(result.debugInfo).toBeDefined();
    expect(result.debugInfo?.errorLocation).toBe('Paragraph.text');
    expect(result.debugInfo?.statement).toBe('paragraph.text');
  });

  it('still works for plain errors (no debugInfo)', async () => {
    delete (globalThis as Record<string, unknown>).Word;
    (globalThis as Record<string, unknown>).Word = {
      run: async () => { throw new Error('plain'); },
    };
    const sandbox = new Sandbox('word');
    sandbox.init();
    const result = await sandbox.execute('return 1;');
    expect(result.success).toBe(false);
    expect(result.error).toBe('plain');
    expect(result.debugInfo).toBeUndefined();
  });
});
