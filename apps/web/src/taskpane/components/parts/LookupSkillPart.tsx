import React from 'react';

export function LookupSkillPart({
  part,
}: {
  part: { state: string; input?: { name?: string }; output?: { body?: string } };
}) {
  const name = part.input?.name ?? '?';
  if (part.state !== 'output-available') {
    return <span style={{ opacity: 0.7, fontSize: 12 }}>Looking up: {name}</span>;
  }
  return <span style={{ opacity: 0.7, fontSize: 12 }}>Looked up: {name}</span>;
}
