import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  createModel: vi.fn(),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return { ...actual, generateText: mocks.generateText };
});
vi.mock('./providers.ts', () => ({ createModel: mocks.createModel }));

import { generateTitle } from './title.ts';
import type { AppSettings } from '../store/settings.ts';
import type { ModelMessage } from 'ai';

const settings: AppSettings = {
  selectedProviderId: 'anthropic',
  selectedModel: 'claude-opus-4-7',
  providers: [{ id: 'anthropic', name: 'Anthropic', apiKey: 'k' }],
  autoApprove: false,
  mcpServers: [],
  maxRetries: 3,
  executionTimeout: 30000,
};

const messages: ModelMessage[] = [
  { role: 'user', content: 'help me build a chart' },
  { role: 'assistant', content: 'Sure, what data?' },
];

describe('generateTitle', () => {
  beforeEach(() => {
    mocks.generateText.mockReset();
    mocks.createModel.mockReset();
    mocks.createModel.mockReturnValue('FAKE_MODEL');
  });

  it('returns a trimmed, capped title from the model', async () => {
    mocks.generateText.mockResolvedValue({ text: '  Build A Sales Chart  ' });
    const out = await generateTitle(messages, settings);
    expect(out).toBe('Build A Sales Chart');
    expect(mocks.createModel).toHaveBeenCalledWith(settings);
  });

  it('caps the title at 50 chars', async () => {
    mocks.generateText.mockResolvedValue({ text: 'A'.repeat(120) });
    const out = await generateTitle(messages, settings);
    expect(out!.length).toBe(50);
  });

  it('returns null on model error', async () => {
    mocks.generateText.mockRejectedValue(new Error('rate limit'));
    const out = await generateTitle(messages, settings);
    expect(out).toBeNull();
  });

  it('returns null on empty/whitespace response', async () => {
    mocks.generateText.mockResolvedValue({ text: '   ' });
    const out = await generateTitle(messages, settings);
    expect(out).toBeNull();
  });

  it('returns null when createModel throws (no API key etc.)', async () => {
    mocks.createModel.mockImplementation(() => { throw new Error('no key'); });
    const out = await generateTitle(messages, settings);
    expect(out).toBeNull();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('strips wrapping quotes from the model response', async () => {
    mocks.generateText.mockResolvedValue({ text: '"Quarterly Plan"' });
    const out = await generateTitle(messages, settings);
    expect(out).toBe('Quarterly Plan');
  });
});
