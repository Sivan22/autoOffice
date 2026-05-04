import { describe, it, expect } from 'vitest';
import { createApp } from '../app';

describe('GET /health', () => {
  const app = createApp({ version: '0.0.0-test' });

  it('returns 200 with ok=true and the configured version', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      version: '0.0.0-test',
    });
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.pid).toBe('number');
  });

  it('does not require authentication', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
  });
});
