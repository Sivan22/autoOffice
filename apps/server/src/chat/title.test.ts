import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: mocks.generateText };
});

import { generateTitle } from './title';
import type { LanguageModel } from 'ai';

const FAKE_MODEL = 'FAKE_MODEL' as unknown as LanguageModel;

const messages = [
  { role: 'user', parts: [{ type: 'text', text: 'help me build a chart' }] },
  { role: 'assistant', parts: [{ type: 'text', text: 'Sure, what data?' }] },
];

describe('generateTitle', () => {
  beforeEach(() => {
    mocks.generateText.mockReset();
  });

  it('returns a trimmed, capped title from the model', async () => {
    mocks.generateText.mockResolvedValue({ text: '  Build A Sales Chart  ' });
    const out = await generateTitle(messages, FAKE_MODEL);
    expect(out).toBe('Build A Sales Chart');
  });

  it('caps the title at 50 chars', async () => {
    mocks.generateText.mockResolvedValue({ text: 'A'.repeat(120) });
    const out = await generateTitle(messages, FAKE_MODEL);
    expect(out!.length).toBe(50);
  });

  it('returns null on model error', async () => {
    mocks.generateText.mockRejectedValue(new Error('rate limit'));
    const out = await generateTitle(messages, FAKE_MODEL);
    expect(out).toBeNull();
  });

  it('returns null on empty/whitespace response', async () => {
    mocks.generateText.mockResolvedValue({ text: '   ' });
    const out = await generateTitle(messages, FAKE_MODEL);
    expect(out).toBeNull();
  });

  it('strips wrapping quotes from the model response', async () => {
    mocks.generateText.mockResolvedValue({ text: '"Quarterly Plan"' });
    const out = await generateTitle(messages, FAKE_MODEL);
    expect(out).toBe('Quarterly Plan');
  });

  it('strips smart quotes', async () => {
    mocks.generateText.mockResolvedValue({ text: '“Quarterly Plan”' });
    const out = await generateTitle(messages, FAKE_MODEL);
    expect(out).toBe('Quarterly Plan');
  });

  it('returns null when transcript is empty (no text parts)', async () => {
    const out = await generateTitle(
      [{ role: 'user', parts: [] }],
      FAKE_MODEL,
    );
    expect(out).toBeNull();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('builds transcript from text parts only', async () => {
    mocks.generateText.mockResolvedValue({ text: 'A Title' });
    await generateTitle(
      [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'hello' },
            { type: 'tool-call', toolCallId: 't1' },
            { type: 'text', text: 'world' },
          ],
        },
      ],
      FAKE_MODEL,
    );
    const prompt = (mocks.generateText.mock.calls[0]?.[0] as { prompt: string }).prompt;
    expect(prompt).toContain('USER: hello world');
  });
});
