import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, ne, like, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppEnv } from '../types.js';
import { racks, assets } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';
import { validationHook } from '../utils/validationHook.js';

const CreateRackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  siteId: z.string().optional(),
  location: z.string().optional(),
  capacityU: z.number().int().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateRackSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  siteId: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  capacityU: z.number().int().min(1).max(200).optional(),
  metadata: z.string().nullable().optional(),
});

export const racksRouter = new Hono<AppEnv>();

racksRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const { hasPagination, limit, offset, search } = parsePagination(c);

  const conditions = [eq(racks.tenantId, tenantId), ne(racks.status, 'deleted')];
  if (search) conditions.push(like(racks.name, `%${search}%`) as any);
  const where = and(...(conditions as any[]));

  if (!hasPagination) {
    const rows = await db.select().from(racks).where(where).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(racks).where(where).all();
  const data = await db.select().from(racks).where(where).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

racksRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(racks.id, id), ne(racks.status, 'deleted')];
  if (tenantId) conditions.push(eq(racks.tenantId, tenantId) as any);
  const rows = await db.select().from(racks).where(and(...(conditions as any[]))).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Rack ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

racksRouter.post('/', zValidator('json', CreateRackSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const row = {
    id: body.id,
    tenantId,
    siteId: body.siteId ?? null,
    name: body.name,
    location: body.location ?? null,
    capacityU: body.capacityU ?? 42,
    status: 'active' as const,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(racks).values(row);
  return c.json(row, 201);
});

racksRouter.patch('/:id', zValidator('json', UpdateRackSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(racks.id, id), ne(racks.status, 'deleted')];
  if (tenantId) conditions.push(eq(racks.tenantId, tenantId) as any);
  const existing = await db.select({ id: racks.id }).from(racks).where(and(...(conditions as any[]))).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Rack ${id} not found` } }, 404);
  }
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if ('location' in body) updates.location = body.location ?? null;
  if ('siteId' in body) updates.siteId = body.siteId ?? null;
  if (body.capacityU !== undefined) updates.capacityU = body.capacityU;
  await db.update(racks).set(updates).where(eq(racks.id, id));
  const updated = await db.select().from(racks).where(eq(racks.id, id)).all();
  return c.json(updated[0]);
});

racksRouter.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(racks.id, id), ne(racks.status, 'deleted')];
  if (tenantId) conditions.push(eq(racks.tenantId, tenantId) as any);
  const rows = await db.select().from(racks).where(and(...(conditions as any[]))).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Rack ${id} not found` } }, 404);
  }
  const linkedAsset = await db.select({ id: assets.id }).from(assets)
    .where(and(eq(assets.rackId, id), ne(assets.status, 'deleted'))).limit(1).all();
  if (linkedAsset.length > 0) {
    await db.update(racks).set({ status: 'deleted', updatedAt: new Date().toISOString() }).where(eq(racks.id, id));
  } else {
    await db.delete(racks).where(eq(racks.id, id));
  }
  return new Response(null, { status: 204 });
});
