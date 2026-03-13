import { Hono } from 'hono';
import { eq, and, ne, like, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { meters, powerReadings } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';

const metersRouter = new Hono<AppEnv>();

// GET /meters — list meters (scoped by tenant)
metersRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const { hasPagination, limit, offset, search } = parsePagination(c);

  const conditions: ReturnType<typeof eq>[] = [eq(meters.tenantId, tenantId), ne(meters.status, 'deleted')];
  if (search) conditions.push(like(meters.name, `%${search}%`));
  const where = and(...conditions);

  if (!hasPagination) {
    const rows = await db.select().from(meters).where(where).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(meters).where(where).all();
  const data = await db.select().from(meters).where(where).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

// GET /meters/:id — get meter by ID (verify tenant ownership)
metersRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(meters.id, id), ne(meters.status, 'deleted')];
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

// PATCH /meters/:id — update meter fields (admin only, tenant-scoped)
metersRouter.patch('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(meters.id, id)];
  if (tenantId) conditions.push(eq(meters.tenantId, tenantId));
  const existing = await db.select({ id: meters.id }).from(meters).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Meter ${id} not found` } }, 404);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.stateCode !== undefined) updates.stateCode = body.stateCode;
  if ('siteId' in body) updates.siteId = body.siteId ?? null;
  if ('tariffId' in body) updates.tariffId = body.tariffId ?? null;
  if ('meterType' in body) updates.meterType = body.meterType ?? null;

  await db.update(meters).set(updates).where(eq(meters.id, id));
  const updated = await db.select().from(meters).where(eq(meters.id, id)).all();
  return c.json(updated[0]);
});

// DELETE /meters/:id — soft-delete if readings exist, hard-delete otherwise (admin only)
metersRouter.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(meters.id, id), ne(meters.status, 'deleted')];
  if (tenantId) conditions.push(eq(meters.tenantId, tenantId));
  const rows = await db.select().from(meters).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Meter ${id} not found` } }, 404);
  }

  const reading = await db.select({ id: powerReadings.id }).from(powerReadings).where(eq(powerReadings.meterId, id)).limit(1).all();
  if (reading.length > 0) {
    await db.update(meters).set({ status: 'deleted', updatedAt: new Date().toISOString() }).where(eq(meters.id, id));
  } else {
    await db.delete(meters).where(eq(meters.id, id));
  }
  return new Response(null, { status: 204 });
});

export { metersRouter };
