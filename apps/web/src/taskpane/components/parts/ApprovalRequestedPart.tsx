import React from 'react';

type Props = {
  part: {
    type: string;
    toolCallId?: string;
    input?: unknown;
    approval?: { id: string };
    state?: string;
  };
  onResponse: (id: string, approved: boolean) => void;
};

export function ApprovalRequestedPart({ part, onResponse }: Props) {
  if (part.state !== 'approval-requested' || !part.approval) return null;
  return (
    <div
      style={{
        border: '1px solid var(--colorPaletteYellowBorder1)',
        padding: 8,
        borderRadius: 4,
      }}
    >
      <div>
        Tool <code>{part.type.replace(/^tool-/, '')}</code> requests approval to run with:
      </div>
      <pre style={{ fontSize: 12 }}>{JSON.stringify(part.input, null, 2)}</pre>
      <div style={{ marginTop: 8 }}>
        <button onClick={() => onResponse(part.approval!.id, true)}>Approve</button>
        <button onClick={() => onResponse(part.approval!.id, false)} style={{ marginLeft: 8 }}>
          Deny
        </button>
      </div>
    </div>
  );
}
