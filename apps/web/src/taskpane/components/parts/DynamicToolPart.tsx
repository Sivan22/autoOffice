import React from 'react';

export function DynamicToolPart({
  part,
}: {
  part: {
    toolName?: string;
    input?: unknown;
    output?: unknown;
    state?: string;
    errorText?: string;
  };
}) {
  return (
    <details style={{ border: '1px solid var(--colorNeutralStroke2)', borderRadius: 4, padding: 4 }}>
      <summary>
        {part.toolName ?? 'tool'} ({part.state ?? 'unknown'})
      </summary>
      <div style={{ fontSize: 12 }}>
        <div>
          <b>Input:</b>
          <pre>{JSON.stringify(part.input, null, 2)}</pre>
        </div>
        {part.output != null && (
          <div>
            <b>Output:</b>
            <pre>{JSON.stringify(part.output, null, 2)}</pre>
          </div>
        )}
        {part.errorText && (
          <div style={{ color: 'var(--colorPaletteRedForeground1)' }}>{part.errorText}</div>
        )}
      </div>
    </details>
  );
}
