export type ErrorKind = 'api' | 'office' | 'sandbox' | 'mcp' | 'config' | 'network' | 'unknown';

export interface FormattedError {
  kind: ErrorKind;
  title: string;
  detail: string;
  raw?: string;
}

export interface ErrorContext {
  provider?: string;
  model?: string;
  tool?: string;
  serverName?: string;
  phase?: 'mcp-connect' | 'stream' | 'tool-execute' | 'agent';
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatError(err: unknown, _ctx: ErrorContext = {}): FormattedError {
  if (err === null || err === undefined) {
    return { kind: 'unknown', title: 'Unexpected error', detail: 'Unknown error' };
  }

  if (typeof err === 'string') {
    return { kind: 'unknown', title: 'Unexpected error', detail: err };
  }

  if (err instanceof Error) {
    if (err.name === 'ConfigError') {
      return {
        kind: 'config',
        title: 'Configuration error',
        detail: err.message,
        raw: err.stack,
      };
    }
    return {
      kind: 'unknown',
      title: 'Unexpected error',
      detail: err.message || 'Unknown error',
      raw: err.stack || safeStringify({ name: err.name, message: err.message }),
    };
  }

  return { kind: 'unknown', title: 'Unexpected error', detail: safeStringify(err) };
}
