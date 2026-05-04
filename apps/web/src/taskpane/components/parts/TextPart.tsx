import React from 'react';

export function TextPart({ part }: { part: { text: string } }) {
  return <span>{part.text}</span>;
}
