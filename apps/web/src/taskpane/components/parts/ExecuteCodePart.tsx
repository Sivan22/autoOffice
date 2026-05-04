import React from 'react';

type Props = {
  part: {
    state: string;
    toolCallId: string;
    input?: { code?: string };
    output?: unknown;
    errorText?: string;
  };
  onApprove: (toolCallId: string, code: string) => void;
  onReject: (toolCallId: string) => void;
  highlight: (code: string) => React.ReactNode;
};

export function ExecuteCodePart({ part, onApprove, onReject, highlight }: Props) {
  const code = part.input?.code ?? '';
  return (
    <div style={{ border: '1px solid var(--colorNeutralStroke2)', borderRadius: 4, padding: 8 }}>
      <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{highlight(code)}</div>
      {part.state === 'input-available' && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => onApprove(part.toolCallId, code)}>Approve</button>
          <button onClick={() => onReject(part.toolCallId)} style={{ marginLeft: 8 }}>
            Reject
          </button>
        </div>
      )}
      {part.state === 'output-available' && (
        <pre style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
          {JSON.stringify(part.output, null, 2)}
        </pre>
      )}
      {part.state === 'output-error' && (
        <pre style={{ marginTop: 8, color: 'var(--colorPaletteRedForeground1)' }}>
          {part.errorText}
        </pre>
      )}
    </div>
  );
}
