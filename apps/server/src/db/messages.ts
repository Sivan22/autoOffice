import type { Database } from 'bun:sqlite';
import { MessageSchema, type Message } from '@autooffice/shared';

export type AppendInput = Omit<Message, 'createdAt'>;

export class MessagesRepo {
  constructor(private readonly db: Database) {}

  append(input: AppendInput): void {
    const created = Date.now();
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, parts, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.conversationId,
        input.role,
        JSON.stringify(input.parts ?? []),
        input.metadata == null ? null : JSON.stringify(input.metadata),
        created,
      );
  }

  replaceAll(conversationId: string, messages: AppendInput[]): void {
    // Dedupe by id, last-wins. The AI SDK's onFinish can hand back the same
    // message id twice across multi-step tool-call rounds; the later copy is
    // the one with tool-result state populated.
    const byId = new Map<string, AppendInput>();
    for (const m of messages) byId.set(m.id, m);
    const deduped = Array.from(byId.values());

    const tx = this.db.transaction((items: AppendInput[]) => {
      this.db
        .prepare('DELETE FROM messages WHERE conversation_id = ?')
        .run(conversationId);
      let i = 0;
      const insert = this.db.prepare(
        `INSERT INTO messages (id, conversation_id, role, parts, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const m of items) {
        insert.run(
          m.id,
          m.conversationId,
          m.role,
          JSON.stringify(m.parts ?? []),
          m.metadata == null ? null : JSON.stringify(m.metadata),
          Date.now() + i++,
        );
      }
    });
    tx(deduped);
  }

  listByConversation(conversationId: string): Message[] {
    const rows = this.db
      .query<
        {
          id: string;
          conversation_id: string;
          role: string;
          parts: string;
          metadata: string | null;
          created_at: number;
        },
        [string]
      >(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      )
      .all(conversationId);
    return rows.map((row) =>
      MessageSchema.parse({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        parts: JSON.parse(row.parts),
        metadata: row.metadata == null ? null : JSON.parse(row.metadata),
        createdAt: row.created_at,
      }),
    );
  }
}
