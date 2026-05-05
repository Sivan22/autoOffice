import React from 'react';

export function LookupSkillPart({
  part,
}: {
  part: { state: string; input?: { name?: string }; output?: { body?: string } };
}) {
  const name = part.input?.name ?? '?';
  if (part.state !== 'output-available') {
    return <span style={{ opacity: 0.7, fontSize: 12, direction: 'ltr', display: 'block' }}>Looking up: {name}</span>;
  }
  return <span style={{ opacity: 0.7, fontSize: 12, direction: 'ltr', display: 'block' }}>Looked up: {name}</span>;
}
