import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createDb } from './db/client.js';
import type { AppEnv } from './types.js';
import { tariffs } from './routes/tariffs.js';
import { metersRouter } from './routes/meters.js';
import { racksRouter } from './routes/racks.js';
import { assetsRouter } from './routes/assets.js';
import { billsRouter } from './routes/bills.js';
import { readingsRouter } from './routes/readings.js';
import { invoicesRouter } from './routes/invoices.js';
import { uploadsRouter } from './routes/uploads.js';
import { agentsRouter } from './routes/agents.js';
import { dashboardRouter } from './routes/dashboard.js';
import { platformRouter } from './routes/platform.js';
import { envReadingsRouter } from './routes/env-readings.js';
import { alertsRouter } from './routes/alerts.js';
import { capacityRouter } from './routes/capacity.js';
import { slaRouter } from './routes/sla.js';
import { notificationsRouter } from './routes/notifications.js';
import { runDailyChecks } from './services/sla.js';
import { processIrpRetryQueue } from './services/irp-retry.js';
import type { Bindings } from './types.js';
import { openApiSpec } from './openapi.js';
import {
  checkLimit,
  AUTHENTICATED_LIMIT,
  UNAUTHENTICATED_LIMIT,
  RATE_LIMITED_PREFIXES,
} from './middleware/rateLimiter.js';

// Cache JWKS across requests within the same isolate
let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSUrl: string | null = null;

const app = new Hono<AppEnv>();

// CORS
app.use('*', cors({
  origin: [
    'https://bharatdcim.com',
    'https://dashboard.bharatdcim.com',
    'http://localhost:4321',
    'https://bharatdcim-dashboard.pages.dev',
    'http://localhost:5173',
  ],
}));

// Error handling
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: err.message || 'Invalid or missing Bearer token' } },
      err.status,
    );
  }
  console.error('Unhandled error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' } },
    500,
  );
});

// Health check (no auth, no database)
app.get('/health', (c) => c.json({ status: 'ok' }));

// OpenAPI spec + Swagger UI (no auth)
app.get('/openapi.json', (c) => c.json(openApiSpec));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// Auth for all API routes — accepts API_TOKEN (for agents/scripts) or Clerk JWT (for dashboard)
const API_PREFIXES = RATE_LIMITED_PREFIXES;
app.use('*', async (c, next) => {
  if (!API_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing Bearer token' });
  }

  const token = authHeader.slice(7);

  // Fast path: shared API token (SNMP agents, scripts, CI)
  if (token === c.env.API_TOKEN) {
    c.set('tenantId', null);
    c.set('authType', 'api_token');
    c.set('orgRole', null);
    c.set('platformAdmin', false);
    return next();
  }

  // Verify Clerk JWT
  const issuerUrl = c.env.CLERK_ISSUER_URL;
  if (issuerUrl) {
    try {
      const jwksUrl = `${issuerUrl}/.well-known/jwks.json`;
      if (!cachedJWKS || cachedJWKSUrl !== jwksUrl) {
        cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
        cachedJWKSUrl = jwksUrl;
      }
      const { payload } = await jwtVerify(token, cachedJWKS, { issuer: issuerUrl });

      // Extract tenant_id from custom session claim
      const tenantId = (payload as Record<string, unknown>).tenant_id as string | undefined;
      // Extract org role from Clerk's compact 'o' claim
      const orgRole = ((payload as Record<string, unknown>).o as Record<string, unknown> | undefined)?.rol as string | undefined;
      // Extract platform admin flag from custom session claim
      const platformAdmin = (payload as Record<string, unknown>).platformAdmin === true
        || (payload as Record<string, unknown>).platformAdmin === 'true';

      if (!tenantId && !platformAdmin) {
        throw new HTTPException(403, { message: 'No active organization. Please select an organization.' });
      }

      c.set('tenantId', tenantId ?? null);
      c.set('authType', 'clerk');
      c.set('orgRole', orgRole ?? null);
      c.set('platformAdmin', platformAdmin);
      return next();
    } catch (e) {
      if (e instanceof HTTPException) throw e;
      // JWT invalid — fall through to 401
    }
  }

  throw new HTTPException(401, { message: 'Invalid or missing Bearer token' });
});

// Rate limiting — runs after auth so tenantId/authType/platformAdmin are available in context
app.use('*', async (c, next) => {
  if (!API_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    return next();
  }

  const authType = c.get('authType');
  // API_TOKEN callers are trusted internal services — no rate limiting
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

// Database middleware — injects db into context for API routes only
app.use('*', async (c, next) => {
  if (API_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    const db = createDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
    c.set('db', db);
    // Set IRP execution context for async IRP generation via ctx.waitUntil
    const execCtx = (c as { executionCtx?: { waitUntil(p: Promise<unknown>): void } }).executionCtx;
    c.set('irpCtx', execCtx ?? { waitUntil: (p) => void p });
  }
  await next();
});

// Routes
app.route('/tariffs', tariffs);
app.route('/meters', metersRouter);
app.route('/bills', billsRouter);
app.route('/readings', readingsRouter);
app.route('/invoices', invoicesRouter);
app.route('/uploads', uploadsRouter);
app.route('/agents', agentsRouter);
app.route('/dashboard', dashboardRouter);
app.route('/platform', platformRouter);
app.route('/racks', racksRouter);
app.route('/assets', assetsRouter);
app.route('/env-readings', envReadingsRouter);
app.route('/alerts', alertsRouter);
app.route('/capacity', capacityRouter);
app.route('/sla', slaRouter);
app.route('/notifications', notificationsRouter);

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export { app };

export default {
  fetch: app.fetch.bind(app),
  async scheduled(event: { cron: string; scheduledTime: number }, env: Bindings, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const db = createDb(env.TURSO_DATABASE_URL, env.TURSO_AUTH_TOKEN);
    if (event.cron === '*/15 * * * *') {
      ctx.waitUntil(processIrpRetryQueue(db, env));
    } else {
      ctx.waitUntil(runDailyChecks(db, env));
    }
  },
};
