import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './db/client.js';
import type { Database } from './db/client.js';
import { tariffs } from './routes/tariffs.js';
import { metersRouter } from './routes/meters.js';
import { billsRouter } from './routes/bills.js';
import { readingsRouter } from './routes/readings.js';
import { invoicesRouter } from './routes/invoices.js';
import { uploadsRouter } from './routes/uploads.js';
import { agentsRouter } from './routes/agents.js';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

type Variables = {
  db: Database;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS
app.use('*', cors({ origin: ['https://bharatdcim.com', 'http://localhost:4321'] }));

// Error handling
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: err.message || 'Internal server error' } },
    500,
  );
});

// Health check (no database needed)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Database middleware — injects db into context for API routes only
const API_PREFIXES = ['/tariffs', '/meters', '/bills', '/readings', '/invoices', '/uploads', '/agents'];
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

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` } }, 404);
});

export default app;
