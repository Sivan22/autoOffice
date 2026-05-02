import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  HISTORY_LIMITS,
  INDEX_KEY,
  blobKeyFor,
  saveConversation,
  getConversation,
  listConversations,
  renameConversation,
  deleteConversation,
  mostRecentForHost,
  __testing,
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

describe('history.ts — rename and delete', () => {
  beforeEach(() => localStorage.clear());

  it('renames the title in both blob and index', () => {
    saveConversation(makeConv({ id: 'r1', title: 'before', updatedAt: 1234 }));
    renameConversation('r1', 'after');
    expect(getConversation('r1')?.title).toBe('after');
    expect(listConversations()[0].title).toBe('after');
    // updatedAt must not move — mostRecentForHost relies on it for ordering.
    expect(getConversation('r1')?.updatedAt).toBe(1234);
    expect(listConversations()[0].updatedAt).toBe(1234);
  });

  it('renaming an unknown id is a no-op (no throw)', () => {
    expect(() => renameConversation('nope', 'x')).not.toThrow();
    expect(listConversations()).toEqual([]);
  });

  it('deletes both blob and index entry', () => {
    saveConversation(makeConv({ id: 'd1' }));
    saveConversation(makeConv({ id: 'd2' }));
    deleteConversation('d1');
    expect(getConversation('d1')).toBeNull();
    expect(localStorage.getItem(blobKeyFor('d1'))).toBeNull();
    expect(listConversations().map(s => s.id)).toEqual(['d2']);
  });

  it('deleting an unknown id is a no-op', () => {
    saveConversation(makeConv({ id: 'd1' }));
    expect(() => deleteConversation('nope')).not.toThrow();
    expect(listConversations()).toHaveLength(1);
  });
});

describe('history.ts — mostRecentForHost', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing exists', () => {
    expect(mostRecentForHost('word')).toBeNull();
  });

  it('returns the newest conversation for the requested host', () => {
    saveConversation(makeConv({ id: 'w-old', host: 'word', updatedAt: 1000 }));
    saveConversation(makeConv({ id: 'w-new', host: 'word', updatedAt: 3000 }));
    saveConversation(makeConv({ id: 'e-newest', host: 'excel', updatedAt: 4000 }));
    expect(mostRecentForHost('word')?.id).toBe('w-new');
    expect(mostRecentForHost('excel')?.id).toBe('e-newest');
  });

  it('returns null when host has no conversations', () => {
    saveConversation(makeConv({ id: 'w', host: 'word' }));
    expect(mostRecentForHost('excel')).toBeNull();
  });
});

function bigString(n: number): string {
  return 'x'.repeat(n);
}

describe('history.ts — eviction (soft total cap)', () => {
  beforeEach(() => {
    localStorage.clear();
    __testing.resetLimits();
  });

  afterAll(() => __testing.resetLimits());

  it('evicts oldest non-active conversations until under the total cap', () => {
    __testing.setLimits(/* total */ 5_000, /* perConv */ 100_000);

    // Each conversation is ~1.5 KB after JSON serialization
    saveConversation(makeConv({
      id: 'old', updatedAt: 1000,
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    saveConversation(makeConv({
      id: 'mid', updatedAt: 2000,
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    saveConversation(makeConv({
      id: 'new', updatedAt: 3000,
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));

    const ids = listConversations().map(s => s.id);
    // With a 5KB cap and ~3KB conversations, both 'old' and 'mid' should be
    // evicted to fit 'new' under the cap.
    expect(ids).not.toContain('old');
    expect(ids).not.toContain('mid');
    expect(ids).toContain('new');
  });

  it('never evicts the just-saved (active) conversation, even if it is the oldest', () => {
    __testing.setLimits(2_000, 100_000);
    // Save two large conversations; the second save pushes us over the cap.
    saveConversation(makeConv({
      id: 'first', updatedAt: 5000, // newer
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    saveConversation(makeConv({
      id: 'second', updatedAt: 1000, // older — but this is the one being saved
      uiMessages: [{ role: 'user', content: bigString(1_400) }],
      modelMessages: [{ role: 'user', content: bigString(1_400) }],
    }));
    const ids = listConversations().map(s => s.id);
    expect(ids).toContain('second'); // active save preserved
    expect(ids).not.toContain('first'); // older non-active evicted
  });
});

describe('history.ts — per-conversation truncation', () => {
  beforeEach(() => {
    localStorage.clear();
    __testing.resetLimits();
  });

  afterAll(() => __testing.resetLimits());

  it('truncates the oldest large codeBlock.result strings until under cap', () => {
    __testing.setLimits(/* total */ 100_000_000, /* perConv */ 1_500);

    const huge = bigString(2_000);
    const conv = makeConv({
      id: 't1',
      uiMessages: [
        { role: 'assistant', content: '', codeBlock: { code: 'a', status: 'success', result: huge } },
        { role: 'assistant', content: '', codeBlock: { code: 'b', status: 'success', result: huge } },
        { role: 'assistant', content: '', codeBlock: { code: 'c', status: 'success', result: 'small' } },
      ],
    });

    saveConversation(conv);

    const stored = getConversation('t1')!;
    // Oldest large result was replaced first
    expect(stored.uiMessages[0].codeBlock!.result).toBe('[truncated]');
    // Smallest / latest should be preserved
    expect(stored.uiMessages[2].codeBlock!.result).toBe('small');
    // Conversation is now under the cap
    const size = new Blob([JSON.stringify(stored)]).size;
    expect(size).toBeLessThanOrEqual(1_500);
  });

  it('preserves message structure even when truncating', () => {
    __testing.setLimits(100_000_000, 800);
    const huge = bigString(3_000);
    saveConversation(makeConv({
      id: 't2',
      uiMessages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: '', codeBlock: { code: 'x', status: 'success', result: huge } },
      ],
    }));
    const stored = getConversation('t2')!;
    expect(stored.uiMessages).toHaveLength(2);
    expect(stored.uiMessages[0].content).toBe('hello');
    expect(stored.uiMessages[1].codeBlock!.result).toBe('[truncated]');
  });

  it("does not mutate the caller's conversation object", () => {
    __testing.setLimits(100_000_000, 500);
    const huge = bigString(2_000);
    const conv = makeConv({
      id: 'nomut',
      uiMessages: [
        { role: 'assistant', content: '', codeBlock: { code: 'x', status: 'success', result: huge } },
      ],
    });
    saveConversation(conv);
    // The stored copy is truncated.
    expect(getConversation('nomut')!.uiMessages[0].codeBlock!.result).toBe('[truncated]');
    // The caller's original object is NOT mutated.
    expect(conv.uiMessages[0].codeBlock!.result).toBe(huge);
  });
});

describe('history.ts — quota-exceeded retry', () => {
  beforeEach(() => {
    localStorage.clear();
    __testing.resetLimits();
  });
  afterAll(() => __testing.resetLimits());

  it('evicts and retries when setItem throws QuotaExceededError once', () => {
    saveConversation(makeConv({ id: 'old', updatedAt: 100 }));
    saveConversation(makeConv({ id: 'new', updatedAt: 999 }));

    // Make the *next* setItem call throw a single QuotaExceededError.
    const real = Storage.prototype.setItem;
    let throws = 1;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (throws > 0 && k.startsWith('autooffice_history_conv_')) {
        throws--;
        const err = new DOMException('quota', 'QuotaExceededError');
        throw err;
      }
      return real.call(this, k, v);
    });

    try {
      saveConversation(makeConv({ id: 'incoming', updatedAt: 2000 }));
    } finally {
      spy.mockRestore();
    }

    const ids = listConversations().map(s => s.id);
    expect(ids).toContain('incoming');
  });
});

describe('history.ts — schema versioning', () => {
  beforeEach(() => localStorage.clear());

  it('readable: getConversation still returns blobs with unknown v', () => {
    const future = { ...makeConv({ id: 'fut' }), v: 99 };
    localStorage.setItem(blobKeyFor('fut'), JSON.stringify(future));
    const read = getConversation('fut');
    expect(read?.v).toBe(99);
  });

  it('writable: saveConversation refuses to overwrite a future-version blob', () => {
    const future = { ...makeConv({ id: 'fut', title: 'future' }), v: 99 };
    localStorage.setItem(blobKeyFor('fut'), JSON.stringify(future));

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveConversation(makeConv({ id: 'fut', title: 'overwritten' }));
    warn.mockRestore();

    // The blob on disk still has v: 99 and the original title.
    expect(getConversation('fut')?.title).toBe('future');
  });
});
