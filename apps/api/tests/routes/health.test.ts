import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';

describe('Health Endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await app.request('/health', undefined, {
      TURSO_DATABASE_URL: 'file::memory:',
      TURSO_AUTH_TOKEN: '',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /nonexistent returns 404 with ApiError format', async () => {
    const res = await app.request('/nonexistent', undefined, {
      TURSO_DATABASE_URL: 'file::memory:',
      TURSO_AUTH_TOKEN: '',
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
