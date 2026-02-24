import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { meters } from '../db/schema.js';

type Env = { Variables: { db: Database } };

const metersRouter = new Hono<Env>();

// GET /meters — list all meters
metersRouter.get('/', async (c) => {
  const db = c.get('db');
  const rows = await db.select().from(meters).all();
  return c.json(rows);
});

// GET /meters/:id — get meter by ID
metersRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db.select().from(meters).where(eq(meters.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Meter ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

// POST /meters — create meter
metersRouter.post('/', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const now = new Date().toISOString();

  if (!body.id || !body.tenantId || !body.name || !body.stateCode) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: id, tenantId, name, stateCode' } },
      400,
    );
  }

  const row = {
    id: body.id as string,
    tenantId: body.tenantId as string,
    name: body.name as string,
    siteId: (body.siteId as string) ?? null,
    stateCode: body.stateCode as string,
    tariffId: (body.tariffId as string) ?? null,
    meterType: (body.meterType as string) ?? null,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(meters).values(row);
  return c.json(row, 201);
});

export { metersRouter };
