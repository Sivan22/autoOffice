import { describe, it, expect, beforeEach } from 'vitest';
import {
  HISTORY_LIMITS,
  INDEX_KEY,
  blobKeyFor,
  saveConversation,
  getConversation,
  listConversations,
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

function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    v: 1,
    title: overrides.title ?? 'Hello',
    host: overrides.host ?? 'word',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 1000,
    messageCount: overrides.messageCount ?? 1,
    uiMessages: overrides.uiMessages ?? [{ role: 'user', content: 'hi' }],
    modelMessages: overrides.modelMessages ?? [{ role: 'user', content: 'hi' }],
  };
}

describe('history.ts — save / get / list', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a conversation through save and get', () => {
    const c = makeConv({ id: 'x1', title: 'first' });
    saveConversation(c);
    const read = getConversation('x1');
    expect(read).toEqual(c);
  });

  it('returns null for an unknown id', () => {
    expect(getConversation('nope')).toBeNull();
  });

  it('upserts: saving with the same id replaces and updates the index', () => {
    const id = 'x2';
    saveConversation(makeConv({ id, title: 'old', updatedAt: 1000, messageCount: 1 }));
    saveConversation(makeConv({ id, title: 'new', updatedAt: 2000, messageCount: 5 }));
    expect(getConversation(id)?.title).toBe('new');
    expect(listConversations()).toHaveLength(1);
    expect(listConversations()[0].messageCount).toBe(5);
  });

  it('lists conversations sorted by updatedAt descending', () => {
    saveConversation(makeConv({ id: 'a', updatedAt: 1000 }));
    saveConversation(makeConv({ id: 'b', updatedAt: 3000 }));
    saveConversation(makeConv({ id: 'c', updatedAt: 2000 }));
    expect(listConversations().map(s => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('list summary excludes the heavy message arrays', () => {
    saveConversation(makeConv({ id: 'a' }));
    const [summary] = listConversations();
    expect(summary).not.toHaveProperty('uiMessages');
    expect(summary).not.toHaveProperty('modelMessages');
    expect(summary).not.toHaveProperty('v');
  });

  it('survives a corrupted blob without clobbering the index', () => {
    saveConversation(makeConv({ id: 'good' }));
    localStorage.setItem(blobKeyFor('bad'), '{not valid json');
    // The index entry for "bad" does not exist (we never saved it), so this is
    // really verifying that getConversation handles a stray corrupted key
    // without throwing.
    expect(getConversation('bad')).toBeNull();
    expect(listConversations().map(s => s.id)).toEqual(['good']);
  });
});
