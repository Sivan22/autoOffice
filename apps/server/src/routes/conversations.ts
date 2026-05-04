import { Hono } from 'hono';
import type { ConversationsRepo } from '../db/conversations';
import type { MessagesRepo } from '../db/messages';

export function conversationsRouter(_convs: ConversationsRepo, _msgs: MessagesRepo) {
  return new Hono(); // filled in next task
}
