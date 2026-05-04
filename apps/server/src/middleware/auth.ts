import type { MiddlewareHandler } from 'hono';

export function bearerAuth(expected: string): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match || match[1] !== expected) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    return next();
  };
}
