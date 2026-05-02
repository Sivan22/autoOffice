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

// Test-only mutation hook. Production code never calls this. Exposed so
// unit tests can shrink the byte caps without overwriting them globally.
export const __testing = {
  setLimits(total: number, perConv: number) {
    HISTORY_LIMITS.TOTAL_BYTES = total;
    HISTORY_LIMITS.PER_CONVERSATION_BYTES = perConv;
  },
  resetLimits() {
    HISTORY_LIMITS.TOTAL_BYTES = 4 * 1024 * 1024;
    HISTORY_LIMITS.PER_CONVERSATION_BYTES = 1 * 1024 * 1024;
  },
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
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    if (isQuotaExceeded(err)) {
      // Consistent with the blob-write contract: quota failures surface as a
      // single warning, never an exception that bubbles into the React tree.
      console.warn('[history] localStorage full; index not updated this turn');
      return;
    }
    throw err;
  }
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

function conversationBytes(c: Conversation): number {
  return new Blob([JSON.stringify(c)]).size;
}

function truncateInPlace(c: Conversation, cap: number): void {
  if (conversationBytes(c) <= cap) return;
  // Walk uiMessages oldest-first, replacing codeBlock.result strings until under cap.
  for (const msg of c.uiMessages) {
    if (conversationBytes(c) <= cap) return;
    const cb = msg.codeBlock;
    if (cb && typeof cb.result === 'string' && cb.result !== '[truncated]') {
      cb.result = '[truncated]';
    }
  }
  // If still over cap, the dominant uncovered source is large
  // modelMessages tool-result strings (we only walk uiMessages here). The
  // total-cap eviction will continue to keep the global store bounded.
}

function isQuotaExceeded(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'QuotaExceededError' || err.code === 22;
  }
  return false;
}

function setItemWithQuotaRetry(key: string, value: string, activeId: string): void {
  try {
    localStorage.setItem(key, value);
    return;
  } catch (err) {
    if (!isQuotaExceeded(err)) throw err;
    // Aggressive eviction: shrink to half the cap to make room.
    evictOldestUntilUnder(activeId, Math.floor(HISTORY_LIMITS.TOTAL_BYTES / 2));
    try {
      localStorage.setItem(key, value);
    } catch (err2) {
      if (isQuotaExceeded(err2)) {
        console.warn('[history] localStorage full; chat history not persisted this turn');
        return;
      }
      throw err2;
    }
  }
}

function totalBlobBytes(): number {
  let sum = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(BLOB_KEY_PREFIX)) {
      const v = localStorage.getItem(k);
      if (v) sum += new Blob([v]).size;
    }
  }
  return sum;
}

function evictOldestUntilUnder(activeId: string, cap: number): void {
  while (totalBlobBytes() > cap) {
    const candidates = readIndex()
      .filter(s => s.id !== activeId)
      .sort((a, b) => a.updatedAt - b.updatedAt); // oldest first
    const oldest = candidates[0];
    if (!oldest) return; // nothing else to evict
    deleteConversation(oldest.id);
  }
}

export function saveConversation(c: Conversation): void {
  // Defensive copy so callers don't see their objects mutated.
  const toStore: Conversation = JSON.parse(JSON.stringify(c));
  truncateInPlace(toStore, HISTORY_LIMITS.PER_CONVERSATION_BYTES);

  // Refuse to overwrite a blob written by a newer schema version.
  const existingRaw = localStorage.getItem(blobKeyFor(toStore.id));
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw) as Partial<Conversation>;
      if (typeof existing.v === 'number' && existing.v > CURRENT_VERSION) {
        console.warn(`[history] refusing to overwrite v${existing.v} blob with v${CURRENT_VERSION}; conversation ${toStore.id} not persisted`);
        return;
      }
    } catch {
      // Corrupt JSON — let normal save path proceed (we'll overwrite garbage).
    }
  }

  setItemWithQuotaRetry(blobKeyFor(toStore.id), JSON.stringify(toStore), toStore.id);
  const index = readIndex().filter(s => s.id !== toStore.id);
  index.push(summarize(toStore));
  writeIndex(index);

  evictOldestUntilUnder(toStore.id, HISTORY_LIMITS.TOTAL_BYTES);
}

export function renameConversation(id: string, title: string): void {
  const conv = getConversation(id);
  if (!conv) return;
  // Route through saveConversation so rename inherits any future
  // size/quota/version enforcement. updatedAt is intentionally not bumped:
  // rename is metadata-only and must not affect mostRecentForHost ordering.
  saveConversation({ ...conv, title });
}

export function deleteConversation(id: string): void {
  localStorage.removeItem(blobKeyFor(id));
  const index = readIndex().filter(s => s.id !== id);
  writeIndex(index);
}

export function mostRecentForHost(host: HostKind): ConversationSummary | null {
  const matches = listConversations().filter(s => s.host === host);
  return matches[0] ?? null;
}
