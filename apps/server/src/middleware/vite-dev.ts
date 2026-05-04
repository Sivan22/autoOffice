import type { Context, MiddlewareHandler } from 'hono';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export async function makeViteMiddleware(): Promise<MiddlewareHandler> {
  const { createServer } = await import('vite');
  const webRoot = fileURLToPath(new URL('../../../web', import.meta.url));
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: 'spa',
  });

  return async (c: Context, next) => {
    if (c.req.path.startsWith('/api') || c.req.path === '/health') {
      return next();
    }
    const url = new URL(c.req.url);
    return new Promise<Response>((resolve, reject) => {
      const fakeReq = { url: url.pathname + url.search, method: c.req.method, headers: Object.fromEntries(c.req.raw.headers) } as any;
      const chunks: Buffer[] = [];
      const fakeRes = {
        statusCode: 200,
        headers: {} as Record<string, string | string[]>,
        setHeader(k: string, v: string | string[]) { this.headers[k.toLowerCase()] = v; },
        getHeader(k: string) { return this.headers[k.toLowerCase()]; },
        appendHeader(k: string, v: string | string[]) {
          const key = k.toLowerCase();
          const cur = this.headers[key];
          if (cur === undefined) this.headers[key] = v;
          else if (Array.isArray(cur)) (cur as string[]).push(...(Array.isArray(v) ? v : [v]));
          else this.headers[key] = [cur as string, ...(Array.isArray(v) ? v : [v])];
        },
        removeHeader(k: string) { delete this.headers[k.toLowerCase()]; },
        writeHead(status: number, headers?: Record<string, string | string[]>) {
          this.statusCode = status;
          if (headers) for (const [k, v] of Object.entries(headers)) this.setHeader(k, v);
          return this;
        },
        write(chunk: Buffer | string) { chunks.push(Buffer.from(chunk)); return true; },
        end(chunk?: Buffer | string) {
          if (chunk) chunks.push(Buffer.from(chunk));
          const respHeaders = new Headers();
          for (const [k, v] of Object.entries(this.headers)) {
            if (Array.isArray(v)) for (const item of v) respHeaders.append(k, String(item));
            else respHeaders.set(k, String(v));
          }
          resolve(new Response(Buffer.concat(chunks), { status: this.statusCode, headers: respHeaders }));
        },
      } as any;
      vite.middlewares(fakeReq, fakeRes, (err: unknown) => {
        if (err) reject(err);
        else resolve(new Response('Not handled', { status: 404 }));
      });
    });
  };
}
