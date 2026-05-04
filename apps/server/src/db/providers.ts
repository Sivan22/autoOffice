import type { Database } from 'bun:sqlite';
import {
  CreateProviderInputSchema,
  type CreateProviderInput,
  type UpdateProviderInput,
  type ProviderConfig,
  ProviderConfigSchema,
  isCliBridge,
  newId,
} from '@autooffice/shared';
import { isDpapiAvailable, wrapSecret, unwrapSecret } from '../secrets/dpapi';

type Row = {
  id: string;
  kind: string;
  label: string;
  config: string;
  encrypted_key: Uint8Array | null;
  created_at: number;
  updated_at: number;
};

export class ProvidersRepo {
  constructor(private readonly db: Database) {}

  create(input: CreateProviderInput): string {
    const parsed = CreateProviderInputSchema.parse(input);
    const id = newId('p');
    const now = Date.now();
    let encrypted: Uint8Array | null = null;
    if (parsed.apiKey != null) {
      if (isCliBridge(parsed.kind)) {
        throw new Error(`Provider kind '${parsed.kind}' does not accept an API key`);
      }
      if (!isDpapiAvailable()) {
        throw new Error('Storing an API key requires Windows (DPAPI). Use a CLI bridge or run on Windows.');
      }
      encrypted = wrapSecret(parsed.apiKey);
    }
    this.db
      .prepare(
        `INSERT INTO provider_configs (id, kind, label, config, encrypted_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, parsed.kind, parsed.label, JSON.stringify(parsed.config ?? {}), encrypted, now, now);
    return id;
  }

  update(id: string, input: UpdateProviderInput): void {
    const cur = this.getRow(id);
    if (!cur) throw new Error('not found');
    const label = input.label ?? cur.label;
    const config = input.config != null ? JSON.stringify(input.config) : cur.config;
    let encrypted = cur.encrypted_key;
    if (input.apiKey != null) {
      if (!isDpapiAvailable()) {
        throw new Error('Storing an API key requires Windows (DPAPI).');
      }
      encrypted = wrapSecret(input.apiKey);
    }
    this.db
      .prepare(
        `UPDATE provider_configs SET label=?, config=?, encrypted_key=?, updated_at=? WHERE id=?`,
      )
      .run(label, config, encrypted, Date.now(), id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM provider_configs WHERE id = ?').run(id);
  }

  get(id: string): ProviderConfig | null {
    const row = this.getRow(id);
    if (!row) return null;
    return this.toView(row);
  }

  list(): ProviderConfig[] {
    const rows = this.db
      .query<Row, []>(
        'SELECT id, kind, label, config, encrypted_key, created_at, updated_at FROM provider_configs ORDER BY created_at ASC',
      )
      .all();
    return rows.map((r) => this.toView(r));
  }

  getDecryptedKey(id: string): string | null {
    const row = this.getRow(id);
    if (!row?.encrypted_key) return null;
    return unwrapSecret(row.encrypted_key);
  }

  private getRow(id: string): Row | null {
    return (
      this.db
        .query<Row, [string]>(
          'SELECT id, kind, label, config, encrypted_key, created_at, updated_at FROM provider_configs WHERE id = ?',
        )
        .get(id) ?? null
    );
  }

  private toView(row: Row): ProviderConfig {
    return ProviderConfigSchema.parse({
      id: row.id,
      kind: row.kind,
      label: row.label,
      config: JSON.parse(row.config),
      hasKey: row.encrypted_key != null,
      status: 'unknown',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
