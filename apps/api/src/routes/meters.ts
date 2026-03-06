import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { meters } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';

const metersRouter = new Hono<AppEnv>();

// GET /meters — list meters (scoped by tenant)
metersRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);
  const rows = await db.select().from(meters).where(eq(meters.tenantId, tenantId)).all();
  return c.json(rows);
});

// GET /meters/:id — get meter by ID (verify tenant ownership)
metersRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(meters.id, id)];
  if (tenantId) conditions.push(eq(meters.tenantId, tenantId));
  const rows = await db.select().from(meters).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Meter ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

// POST /meters — create meter (tenant from JWT, admin only)
metersRouter.post('/', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const body = await c.req.json();
  const now = new Date().toISOString();

  if (!body.id || !body.name || !body.stateCode) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: id, name, stateCode' } },
      400,
    );
  }

  const row = {
    id: body.id as string,
    tenantId: tenantId,
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
