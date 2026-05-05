import type { Database } from 'bun:sqlite';
import {
  ConversationSchema,
  type Conversation,
  type Host,
  newId,
} from '@autooffice/shared';

export type CreateConversationInput = {
  host: Host;
  id?: string;
  title?: string | null;
  providerId?: string | null;
  modelId?: string | null;
};

export class ConversationsRepo {
  constructor(private readonly db: Database) {}

  create(input: CreateConversationInput): string {
    const id = input.id ?? newId('c');
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO conversations (id, title, host, provider_id, model_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.title ?? null,
        input.host,
        input.providerId ?? null,
        input.modelId ?? null,
        now,
        now,
      );
    return id;
  }

  get(id: string): Conversation | null {
    const row = this.db
      .query<
        {
          id: string;
          title: string | null;
          host: string;
          provider_id: string | null;
          model_id: string | null;
          created_at: number;
          updated_at: number;
        },
        [string]
      >('SELECT * FROM conversations WHERE id = ?')
      .get(id);
    if (!row) return null;
    return ConversationSchema.parse({
      id: row.id,
      title: row.title,
      host: row.host,
      providerId: row.provider_id,
      modelId: row.model_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  list(): Conversation[] {
    const rows = this.db
      .query<
        {
          id: string;
          title: string | null;
          host: string;
          provider_id: string | null;
          model_id: string | null;
          created_at: number;
          updated_at: number;
        },
        []
      >(
        'SELECT id, title, host, provider_id, model_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC',
      )
      .all();
    return rows.map((row) =>
      ConversationSchema.parse({
        id: row.id,
        title: row.title,
        host: row.host,
        providerId: row.provider_id,
        modelId: row.model_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  rename(id: string, title: string): void {
    this.db
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, Date.now(), id);
  }

  touch(id: string): void {
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(Date.now(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  }
}
