import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { bearerAuth } from 'hono/bearer-auth';
import { swaggerUI } from '@hono/swagger-ui';
import { createDb } from './db/client.js';
import type { Database } from './db/client.js';
import { tariffs } from './routes/tariffs.js';
import { metersRouter } from './routes/meters.js';
import { billsRouter } from './routes/bills.js';
import { readingsRouter } from './routes/readings.js';
import { invoicesRouter } from './routes/invoices.js';
import { uploadsRouter } from './routes/uploads.js';
import { agentsRouter } from './routes/agents.js';
import { dashboardRouter } from './routes/dashboard.js';
import { openApiSpec } from './openapi.js';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  API_TOKEN: string;
};

type Variables = {
  db: Database;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing Bearer token' } },
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

// Bearer token auth for all API routes
const API_PREFIXES = ['/tariffs', '/meters', '/bills', '/readings', '/invoices', '/uploads', '/agents', '/dashboard'];
app.use('*', async (c, next) => {
  if (API_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    const auth = bearerAuth({ token: c.env.API_TOKEN });
    return auth(c, next);
  }
  await next();
});

// Database middleware — injects db into context for API routes only
app.use('*', async (c, next) => {
  if (API_PREFIXES.some((p) => c.req.path === p || c.req.path.startsWith(p + '/'))) {
    const db = createDb(c.env.TURSO_DATABASE_URL, c.env.TURSO_AUTH_TOKEN);
    c.set('db', db);
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

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export default app;
