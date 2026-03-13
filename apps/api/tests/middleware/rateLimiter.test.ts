import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLimit,
  clearBuckets,
  AUTHENTICATED_LIMIT,
  UNAUTHENTICATED_LIMIT,
  RATE_LIMITED_PREFIXES,
} from '../../src/middleware/rateLimiter.js';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import type { Database } from '../../src/db/client.js';

// ---------------------------------------------------------------------------
// Unit tests for checkLimit pure function
// ---------------------------------------------------------------------------

describe('checkLimit', () => {
  beforeEach(() => clearBuckets());

  it('allows all requests within the limit', () => {
    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) {
      expect(checkLimit('tenant-1', AUTHENTICATED_LIMIT)).toBe(false);
    }
  });

  it('blocks the request that exceeds the limit', () => {
    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) checkLimit('tenant-1', AUTHENTICATED_LIMIT);
    expect(checkLimit('tenant-1', AUTHENTICATED_LIMIT)).toBe(true);
  });

  it('separate keys do not interfere with each other', () => {
    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) checkLimit('tenant-1', AUTHENTICATED_LIMIT);
    // tenant-2 should still be allowed even though tenant-1 is exhausted
    expect(checkLimit('tenant-2', AUTHENTICATED_LIMIT)).toBe(false);
  });

  it('timestamps outside the 60-second window expire', () => {
    const t0 = 1_000_000;
    // Fill the bucket at time t0
    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) checkLimit('key', AUTHENTICATED_LIMIT, t0);
    // At t0 + 61s, all prior timestamps are older than the window — slot is free again
    expect(checkLimit('key', AUTHENTICATED_LIMIT, t0 + 61_000)).toBe(false);
  });

  it('enforces low limit for unauthenticated keys', () => {
    for (let i = 0; i < UNAUTHENTICATED_LIMIT; i++) checkLimit('anon', UNAUTHENTICATED_LIMIT);
    expect(checkLimit('anon', UNAUTHENTICATED_LIMIT)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: rate limiting in a Hono app
// ---------------------------------------------------------------------------

/** Inline rate-limit middleware that mirrors what index.ts registers. */
function addRateLimiter(app: ReturnType<typeof createAppWithTenant>) {
  app.use('*', async (c, next) => {
    // Skip paths not subject to rate limiting
    const path = c.req.path;
    if (!RATE_LIMITED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
      return next();
    }

    const authType = c.get('authType');
    // API_TOKEN callers are trusted internal services — skip rate limiting
    if (authType === 'api_token') return next();

    const tenantId = c.get('tenantId');
    const platformAdmin = c.get('platformAdmin');

    let key: string;
    let limit: number;

    if (tenantId) {
      key = `tenant:${tenantId}`;
      limit = AUTHENTICATED_LIMIT;
    } else if (platformAdmin) {
      key = 'platform_admin';
      limit = AUTHENTICATED_LIMIT;
    } else {
      key = `anon:${c.req.header('CF-Connecting-IP') ?? 'unknown'}`;
      limit = UNAUTHENTICATED_LIMIT;
    }

    if (checkLimit(key, limit)) {
      return c.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again in 60 seconds.' } },
        429,
        { 'Retry-After': '60' },
      );
    }

    return next();
  });
}

describe('rate limiter middleware', () => {
  let db: Database;

  beforeEach(async () => {
    clearBuckets();
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
  });

  it('allows authenticated requests within the 100/min limit', async () => {
    const app = createAppWithTenant(db, 'tenant-a');
    addRateLimiter(app);
    app.get('/meters', (c) => c.json({ ok: true }));

    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) {
      const res = await app.request('/meters');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 on the 101st request for an authenticated user', async () => {
    const app = createAppWithTenant(db, 'tenant-b');
    addRateLimiter(app);
    app.get('/meters', (c) => c.json({ ok: true }));

    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) await app.request('/meters');
    const res = await app.request('/meters');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('sets Retry-After header on 429 response', async () => {
    const app = createAppWithTenant(db, 'tenant-c');
    addRateLimiter(app);
    app.get('/meters', (c) => c.json({ ok: true }));

    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) await app.request('/meters');
    const res = await app.request('/meters');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('does not rate limit API_TOKEN callers', async () => {
    const app = createAppWithTenant(db, null, { authType: 'api_token', orgRole: null });
    addRateLimiter(app);
    app.get('/meters', (c) => c.json({ ok: true }));

    for (let i = 0; i < 150; i++) {
      const res = await app.request('/meters');
      expect(res.status).toBe(200);
    }
  });

  it('uses separate buckets for different tenants', async () => {
    // Two apps, one per tenant
    const appA = createAppWithTenant(db, 'tenant-x');
    addRateLimiter(appA);
    appA.get('/meters', (c) => c.json({ ok: true }));

    const appB = createAppWithTenant(db, 'tenant-y');
    addRateLimiter(appB);
    appB.get('/meters', (c) => c.json({ ok: true }));

    // Exhaust tenant-x
    for (let i = 0; i < AUTHENTICATED_LIMIT; i++) await appA.request('/meters');
    expect((await appA.request('/meters')).status).toBe(429);

    // tenant-y should still be allowed
    expect((await appB.request('/meters')).status).toBe(200);
  });

  it('skips rate limiting for paths not in RATE_LIMITED_PREFIXES', async () => {
    const app = createAppWithTenant(db, 'tenant-z');
    addRateLimiter(app);
    app.get('/health', (c) => c.json({ status: 'ok' }));

    // 200 requests to /health — none should be rate limited
    for (let i = 0; i < 200; i++) {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
    }
  });
});
