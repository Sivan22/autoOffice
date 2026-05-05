let token: string | null = null;
let version: string | null = null;

export async function bootstrap(): Promise<{ token: string; version: string }> {
  const res = await fetch('/bootstrap', { credentials: 'omit' });
  if (!res.ok) throw new Error(`bootstrap failed: ${res.status}`);
  const body = (await res.json()) as { token: string; version: string };
  token = body.token;
  version = body.version;
  return body;
}

export function getToken(): string {
  if (!token) throw new Error('Call bootstrap() first');
  return token;
}

export function getVersion(): string {
  return version ?? '';
}

// test-only helpers
export function getTokenForTests(): string | null {
  return token;
}

export function _resetForTests(): void {
  token = null;
  version = null;
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${getToken()}` };
}

async function readErrorMessage(res: Response): Promise<string> {
  // Server routes return { error: "..." } as JSON on 4xx/5xx. Surface that
  // text so the UI can show a useful message instead of a bare status code.
  const ct = res.headers.get('content-type') ?? '';
  let detail = '';
  try {
    if (ct.includes('application/json')) {
      const body = (await res.json()) as { error?: unknown; message?: unknown };
      const msg = body.error ?? body.message;
      if (typeof msg === 'string' && msg.length > 0) detail = msg;
    } else {
      const text = (await res.text()).trim();
      if (text) detail = text;
    }
  } catch {
    /* fall through to status-only message */
  }
  return detail ? `${detail} (HTTP ${res.status})` : `HTTP ${res.status}`;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${path}: ${await readErrorMessage(res)}`);
  return (await res.json()) as T;
}

export async function apiSend<T = unknown>(
  path: string,
  body: unknown,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: ${await readErrorMessage(res)}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
