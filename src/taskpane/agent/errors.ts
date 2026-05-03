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

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

function extractApiDetail(responseBody: unknown): string | undefined {
  if (typeof responseBody !== 'string') return undefined;
  const parsed = tryParseJson(responseBody);
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const errField = obj.error;
    if (errField && typeof errField === 'object') {
      const msg = (errField as Record<string, unknown>).message;
      if (typeof msg === 'string' && msg.length > 0) return msg;
    }
    if (typeof obj.message === 'string' && obj.message.length > 0) return obj.message;
  }
  return responseBody;
}

function isApiCallError(err: Error & Record<string, unknown>): boolean {
  if (err.name === 'AI_APICallError') return true;
  return typeof err.statusCode === 'number' && 'responseBody' in err;
}

function isOfficeError(e: Error & Record<string, unknown>): boolean {
  return typeof e.code === 'string' && typeof e.debugInfo === 'object' && e.debugInfo !== null;
}

function isNetworkError(e: Error): boolean {
  if (e.name === 'AbortError') return true;
  return e.name === 'TypeError' && /failed to fetch|networkerror|load failed/i.test(e.message);
}

const CONFIG_ERROR_NAMES = new Set([
  'ConfigError',
  'AI_LoadAPIKeyError',
  'AI_NoSuchModelError',
  'AI_NoSuchProviderError',
]);

const API_ERROR_NAMES = new Set([
  'AI_NoContentGeneratedError',
  'AI_NoOutputGeneratedError',
  'AI_InvalidResponseDataError',
]);

export function formatError(err: unknown, ctx: ErrorContext = {}): FormattedError {
  if (err === null || err === undefined) {
    return { kind: 'unknown', title: 'Unexpected error', detail: 'Unknown error' };
  }
  if (typeof err === 'string') {
    return { kind: 'unknown', title: 'Unexpected error', detail: err };
  }
  if (!(err instanceof Error)) {
    return { kind: 'unknown', title: 'Unexpected error', detail: safeStringify(err) };
  }

  const e = err as Error & Record<string, unknown>;

  if (ctx.phase === 'mcp-connect') {
    return {
      kind: 'mcp',
      title: ctx.serverName ? `MCP server "${ctx.serverName}" unreachable` : 'MCP server unreachable',
      detail: e.message || 'Connection failed',
      raw: safeStringify({ name: e.name, message: e.message, serverName: ctx.serverName, stack: e.stack }),
    };
  }

  if (isOfficeError(e)) {
    const debug = e.debugInfo as Record<string, unknown>;
    const code = (e.code as string) || (debug.code as string) || 'Unknown';
    const dbgMsg = (debug.message as string) || e.message || '';
    const loc = debug.errorLocation as string | undefined;
    const stmt = debug.statement as string | undefined;
    const detailParts = [dbgMsg, loc ? `Location: ${loc}` : '', stmt ? `Statement: ${stmt}` : '']
      .filter(Boolean)
      .join('\n');
    return {
      kind: 'office',
      title: `Office.js error: ${code}`,
      detail: detailParts || e.message,
      raw: safeStringify({ code, debugInfo: debug, stack: e.stack }),
    };
  }

  if (isNetworkError(e)) {
    return {
      kind: 'network',
      title: e.name === 'AbortError' ? 'Request cancelled' : 'Network error',
      detail: e.message,
      raw: e.stack,
    };
  }

  if (CONFIG_ERROR_NAMES.has(e.name)) {
    return {
      kind: 'config',
      title: 'Configuration error',
      detail: e.message,
      raw: e.stack,
    };
  }

  if (isApiCallError(e)) {
    const status = typeof e.statusCode === 'number' ? e.statusCode : undefined;
    const providerPart = ctx.provider ? `${ctx.provider} ` : '';
    const statusPart = status !== undefined ? ` (${status})` : '';
    const detail = extractApiDetail(e.responseBody) ?? e.message;
    return {
      kind: 'api',
      title: `${providerPart}API error${statusPart}`,
      detail,
      raw: safeStringify({
        name: e.name,
        message: e.message,
        statusCode: status,
        url: e.url,
        responseBody: e.responseBody,
        data: e.data,
        provider: ctx.provider,
        model: ctx.model,
      }),
    };
  }

  if (API_ERROR_NAMES.has(e.name)) {
    const providerPart = ctx.provider ? `${ctx.provider} ` : '';
    const title = e.name === 'AI_NoContentGeneratedError'
      ? `${ctx.provider ? `${ctx.provider} returned no content` : 'API returned no content'}`
      : `${providerPart}API error`.trim();
    return {
      kind: 'api',
      title,
      detail: e.message || 'No detail available',
      raw: safeStringify({ name: e.name, message: e.message, model: ctx.model, provider: ctx.provider }),
    };
  }

  return {
    kind: 'unknown',
    title: 'Unexpected error',
    detail: e.message || 'Unknown error',
    raw: e.stack || safeStringify({ name: e.name, message: e.message }),
  };
}
