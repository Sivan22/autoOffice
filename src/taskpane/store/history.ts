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

function readIndex(): ConversationSummary[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConversationSummary[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(index: ConversationSummary[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function summarize(c: Conversation): ConversationSummary {
  return {
    id: c.id,
    title: c.title,
    host: c.host,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messageCount,
  };
}

export function listConversations(): ConversationSummary[] {
  return [...readIndex()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  try {
    const raw = localStorage.getItem(blobKeyFor(id));
    if (!raw) return null;
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

export function saveConversation(c: Conversation): void {
  localStorage.setItem(blobKeyFor(c.id), JSON.stringify(c));
  const index = readIndex().filter(s => s.id !== c.id);
  index.push(summarize(c));
  writeIndex(index);
}
