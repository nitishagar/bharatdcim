import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppEnv } from '../types.js';
import { assets, racks } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';
import { validationHook } from '../utils/validationHook.js';

const ASSET_TYPES = ['server', 'storage', 'network', 'pdu', 'ups', 'cooling', 'other'] as const;

const CreateAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  assetType: z.enum(ASSET_TYPES),
  rackId: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  rackUnitStart: z.number().int().min(1).optional(),
  rackUnitSize: z.number().int().min(1).max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  assetType: z.enum(ASSET_TYPES).optional(),
  rackId: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  rackUnitStart: z.number().int().min(1).nullable().optional(),
  rackUnitSize: z.number().int().min(1).max(50).optional(),
});

export const assetsRouter = new Hono<AppEnv>();

assetsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const { hasPagination, limit, offset } = parsePagination(c);
  const rackIdFilter = c.req.query('rack_id');

  const conditions: ReturnType<typeof eq>[] = [eq(assets.tenantId, tenantId), ne(assets.status, 'deleted')];
  if (rackIdFilter) conditions.push(eq(assets.rackId, rackIdFilter) as any);
  const where = and(...(conditions as any[]));

  if (!hasPagination) {
    const rows = await db.select().from(assets).where(where).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(assets).where(where).all();
  const data = await db.select().from(assets).where(where).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

assetsRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(assets.id, id), ne(assets.status, 'deleted')];
  if (tenantId) conditions.push(eq(assets.tenantId, tenantId) as any);
  const rows = await db.select().from(assets).where(and(...(conditions as any[]))).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Asset ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

assetsRouter.post('/', zValidator('json', CreateAssetSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  const body = c.req.valid('json');

  // If rack_id provided, verify it belongs to this tenant
  if (body.rackId) {
    const rack = await db.select({ id: racks.id }).from(racks)
      .where(and(eq(racks.id, body.rackId), eq(racks.tenantId, tenantId), ne(racks.status, 'deleted'))).limit(1).all();
    if (rack.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: `Rack ${body.rackId} not found` } }, 404);
    }
  }

  const now = new Date().toISOString();
  const row = {
    id: body.id,
    tenantId,
    rackId: body.rackId ?? null,
    name: body.name,
    assetType: body.assetType,
    manufacturer: body.manufacturer ?? null,
    model: body.model ?? null,
    serialNumber: body.serialNumber ?? null,
    rackUnitStart: body.rackUnitStart ?? null,
    rackUnitSize: body.rackUnitSize ?? 1,
    status: 'active' as const,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(assets).values(row);
  return c.json(row, 201);
});

assetsRouter.patch('/:id', zValidator('json', UpdateAssetSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(assets.id, id), ne(assets.status, 'deleted')];
  if (tenantId) conditions.push(eq(assets.tenantId, tenantId) as any);
  const existing = await db.select({ id: assets.id }).from(assets).where(and(...(conditions as any[]))).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Asset ${id} not found` } }, 404);
  }
  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.assetType !== undefined) updates.assetType = body.assetType;
  if ('rackId' in body) updates.rackId = body.rackId ?? null;
  if ('manufacturer' in body) updates.manufacturer = body.manufacturer ?? null;
  if ('model' in body) updates.model = body.model ?? null;
  if ('serialNumber' in body) updates.serialNumber = body.serialNumber ?? null;
  if ('rackUnitStart' in body) updates.rackUnitStart = body.rackUnitStart ?? null;
  if (body.rackUnitSize !== undefined) updates.rackUnitSize = body.rackUnitSize;
  await db.update(assets).set(updates).where(eq(assets.id, id));
  const updated = await db.select().from(assets).where(eq(assets.id, id)).all();
  return c.json(updated[0]);
});

assetsRouter.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(assets.id, id), ne(assets.status, 'deleted')];
  if (tenantId) conditions.push(eq(assets.tenantId, tenantId) as any);
  const rows = await db.select({ id: assets.id }).from(assets).where(and(...(conditions as any[]))).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Asset ${id} not found` } }, 404);
  }
  await db.delete(assets).where(eq(assets.id, id));
  return new Response(null, { status: 204 });
});
