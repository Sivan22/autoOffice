export type HostKind = 'word' | 'excel' | 'powerpoint';

export interface HostContext {
  kind: HostKind;
  displayName: string;
}

export class UnsupportedHostError extends Error {
  constructor(actual: string) {
    super(`AutoOffice does not support this Office host: ${actual}`);
    this.name = 'UnsupportedHostError';
  }
}

export function detectHost(): HostContext {
  if (typeof Office === 'undefined' || !Office.context || !Office.context.host) {
    // Dev mode (vite preview, no Office, or Office.js loaded but not inside
    // an Office host). Default to Word so the existing Word-only dev
    // experience keeps working when you visit the URL directly.
    return { kind: 'word', displayName: 'Word' };
  }
  switch (Office.context.host) {
    case Office.HostType.Word:
      return { kind: 'word', displayName: 'Word' };
    case Office.HostType.Excel:
      return { kind: 'excel', displayName: 'Excel' };
    case Office.HostType.PowerPoint:
      return { kind: 'powerpoint', displayName: 'PowerPoint' };
    default:
      throw new UnsupportedHostError(String(Office.context.host));
  }
}
