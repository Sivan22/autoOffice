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
        headers: {} as Record<string, string>,
        setHeader(k: string, v: string) { this.headers[k.toLowerCase()] = v; },
        getHeader(k: string) { return this.headers[k.toLowerCase()]; },
        write(chunk: Buffer | string) { chunks.push(Buffer.from(chunk)); return true; },
        end(chunk?: Buffer | string) {
          if (chunk) chunks.push(Buffer.from(chunk));
          resolve(new Response(Buffer.concat(chunks), { status: this.statusCode, headers: this.headers }));
        },
      } as any;
      vite.middlewares(fakeReq, fakeRes, (err: unknown) => {
        if (err) reject(err);
        else resolve(new Response('Not handled', { status: 404 }));
      });
    });
  };
}
