import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './index';
import { ConversationsRepo } from './conversations';
import { MessagesRepo } from './messages';

describe('MessagesRepo', () => {
  let convs: ConversationsRepo;
  let msgs: MessagesRepo;
  let convId: string;

  beforeEach(() => {
    const db = openDb({ url: ':memory:' });
    convs = new ConversationsRepo(db);
    msgs = new MessagesRepo(db);
    convId = convs.create({ host: 'word' });
  });

  it('appends and reads messages in insertion order', () => {
    msgs.append({
      id: 'msg_1',
      conversationId: convId,
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      metadata: null,
    });
    msgs.append({
      id: 'msg_2',
      conversationId: convId,
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello' }],
      metadata: null,
    });
    const list = msgs.listByConversation(convId);
    expect(list.map((m) => m.id)).toEqual(['msg_1', 'msg_2']);
    expect((list[1]!.parts[0] as any).text).toBe('hello');
  });

  it('replaceAll wipes prior messages and inserts fresh', () => {
    msgs.append({
      id: 'msg_old',
      conversationId: convId,
      role: 'user',
      parts: [],
      metadata: null,
    });
    msgs.replaceAll(convId, [
      { id: 'msg_new1', conversationId: convId, role: 'user', parts: [], metadata: null },
      { id: 'msg_new2', conversationId: convId, role: 'assistant', parts: [], metadata: null },
    ]);
    expect(msgs.listByConversation(convId).map((m) => m.id)).toEqual(['msg_new1', 'msg_new2']);
  });

  it('cascades on conversation delete', () => {
    msgs.append({
      id: 'msg_a',
      conversationId: convId,
      role: 'user',
      parts: [],
      metadata: null,
    });
    convs.delete(convId);
    expect(msgs.listByConversation(convId)).toEqual([]);
  });
});
