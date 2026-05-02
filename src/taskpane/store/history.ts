import type { ModelMessage } from 'ai';
import type { ChatMessage } from '../agent/orchestrator.ts';
import type { HostKind } from '../host/context.ts';

export const INDEX_KEY = 'autooffice_history_index';
const BLOB_KEY_PREFIX = 'autooffice_history_conv_';

export function blobKeyFor(id: string): string {
  return `${BLOB_KEY_PREFIX}${id}`;
}

export const HISTORY_LIMITS = {
  TOTAL_BYTES: 4 * 1024 * 1024,
  PER_CONVERSATION_BYTES: 1 * 1024 * 1024,
};

export type ConversationVersion = 1;
export const CURRENT_VERSION: ConversationVersion = 1;

export interface ConversationSummary {
  id: string;
  title: string;
  host: HostKind;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Conversation extends ConversationSummary {
  v: ConversationVersion;
  uiMessages: ChatMessage[];
  modelMessages: ModelMessage[];
}
