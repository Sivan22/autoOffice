import type { Context, MiddlewareHandler } from 'hono';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';

class FakeServerResponse extends Writable {
  statusCode = 200;
  headers: Record<string, string | string[]> = {};
  private chunks: Buffer[] = [];
  constructor(private onFinish: (status: number, headers: Record<string, string | string[]>, body: Buffer) => void) {
    super();
  }
  _write(chunk: Buffer | string, _enc: BufferEncoding, cb: (err?: Error) => void) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    cb();
  }
  _final(cb: (err?: Error) => void) {
    this.onFinish(this.statusCode, this.headers, Buffer.concat(this.chunks));
    cb();
  }
  setHeader(k: string, v: string | string[]) { this.headers[k.toLowerCase()] = v; }
  getHeader(k: string) { return this.headers[k.toLowerCase()]; }
  appendHeader(k: string, v: string | string[]) {
    const key = k.toLowerCase();
    const cur = this.headers[key];
    if (cur === undefined) this.headers[key] = v;
    else if (Array.isArray(cur)) cur.push(...(Array.isArray(v) ? v : [v]));
    else this.headers[key] = [cur, ...(Array.isArray(v) ? v : [v])];
  }
  removeHeader(k: string) { delete this.headers[k.toLowerCase()]; }
  writeHead(status: number, headers?: Record<string, string | string[]>) {
    this.statusCode = status;
    if (headers) for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
    return this;
  }
}

export async function makeViteMiddleware(): Promise<MiddlewareHandler> {
  const { createServer } = await import('vite');
  const webRoot = fileURLToPath(new URL('../../../web', import.meta.url));
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: 'spa',
    logLevel: 'silent',
    clearScreen: false,
  });

  return async (c: Context, next) => {
    if (c.req.path.startsWith('/api') || c.req.path === '/health') {
      return next();
    }
    const url = new URL(c.req.url);
    return new Promise<Response>((resolve, reject) => {
      const fakeReq = { url: url.pathname + url.search, method: c.req.method, headers: Object.fromEntries(c.req.raw.headers) } as any;
      const fakeRes = new FakeServerResponse((status, headers, body) => {
        const respHeaders = new Headers();
        for (const [k, v] of Object.entries(headers)) {
          if (Array.isArray(v)) for (const item of v) respHeaders.append(k, String(item));
          else respHeaders.set(k, String(v));
        }
        resolve(new Response(body, { status, headers: respHeaders }));
      });
      fakeRes.on('error', reject);
      vite.middlewares(fakeReq as any, fakeRes as any, (err: unknown) => {
        if (err) reject(err);
        else resolve(new Response('Not handled', { status: 404 }));
      });
    });
  };
}
