import React, { useState } from 'react';
import type { LegacyImportPayload, LegacyImportResult } from '@autooffice/shared';
import { apiSend } from '../api';
import { clearLegacy } from '../legacy/detect';

type Props = {
  payload: LegacyImportPayload;
  onDone: () => void;
};

export function LegacyImportModal({ payload, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = `${payload.conversations.length} conversation(s)` +
    (payload.settings ? ', settings' : '');

  async function migrate() {
    setBusy(true);
    setError(null);
    try {
      await apiSend<LegacyImportResult>('/api/import-legacy', payload);
      clearLegacy();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-label="Import previous AutoOffice data" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: 'var(--colorNeutralBackground1)', padding: 16, maxWidth: 320, borderRadius: 8 }}>
        <h2 style={{ marginTop: 0 }}>Import previous AutoOffice data?</h2>
        <p>We found data from an earlier version: {summary}.</p>
        <p>Click Import to copy it into the local server. Click Skip to start fresh.</p>
        {error && <p style={{ color: 'var(--colorPaletteRedForeground1)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onDone} disabled={busy}>Skip</button>
          <button onClick={migrate} disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      </div>
    </div>
  );
}
