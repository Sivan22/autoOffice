import { describe, it, expect, beforeEach } from 'vitest';
import {
  HISTORY_LIMITS,
  INDEX_KEY,
  blobKeyFor,
  type ConversationSummary,
  type Conversation,
} from './history.ts';

describe('history.ts — constants and key helpers', () => {
  beforeEach(() => localStorage.clear());

  it('exposes tunable byte limits with sane defaults', () => {
    expect(HISTORY_LIMITS.TOTAL_BYTES).toBe(4 * 1024 * 1024);
    expect(HISTORY_LIMITS.PER_CONVERSATION_BYTES).toBe(1 * 1024 * 1024);
  });

  it('uses the documented index key', () => {
    expect(INDEX_KEY).toBe('autooffice_history_index');
  });

  it('builds blob keys with the conv prefix', () => {
    expect(blobKeyFor('abc')).toBe('autooffice_history_conv_abc');
  });

  it('Conversation extends ConversationSummary structurally', () => {
    const summary: ConversationSummary = {
      id: 'a', title: 't', host: 'word', createdAt: 1, updatedAt: 1, messageCount: 0,
    };
    const conv: Conversation = {
      ...summary, v: 1, uiMessages: [], modelMessages: [],
    };
    expect(conv.v).toBe(1);
  });
});
