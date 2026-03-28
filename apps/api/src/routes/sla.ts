import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { slaConfigs, slaViolations, meters } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { validationHook } from '../utils/validationHook.js';
import { CreateSLASchema, UpdateSLASchema, UpdateViolationSchema } from '../schemas/sla.js';

const slaRouter = new Hono<AppEnv>();

// POST /sla — create SLA config (admin only)
slaRouter.post('/', zValidator('json', CreateSLASchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }

  const body = c.req.valid('json');

  // Verify optional meterId belongs to this tenant
  if (body.meterId) {
    const meterRows = await db
      .select({ id: meters.id })
      .from(meters)
      .where(and(eq(meters.id, body.meterId), eq(meters.tenantId, tenantId)))
      .all();
    if (meterRows.length === 0) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Meter not found or belongs to another tenant' } }, 403);
    }
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    tenantId,
    name: body.name,
    type: body.type,
    targetBps: body.targetBps,
    measurementWindow: body.measurementWindow ?? 'monthly',
    meterId: body.meterId ?? null,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(slaConfigs).values(row);
  return c.json(row, 201);
});

// GET /sla — list SLA configs for tenant
slaRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const rows = await db
    .select()
    .from(slaConfigs)
    .where(eq(slaConfigs.tenantId, tenantId))
    .all();

  return c.json(rows);
});

// GET /sla/:id — get single SLA config with currentCompliance
slaRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const rows = await db.select().from(slaConfigs).where(eq(slaConfigs.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `SLA config ${id} not found` } }, 404);
  }

  if (rows[0].tenantId !== tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  // Return with currentCompliance: null (computed on demand separately)
  return c.json({ ...rows[0], currentCompliance: null });
});

// PATCH /sla/:id — update SLA config (admin only)
slaRouter.patch('/:id', zValidator('json', UpdateSLASchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(slaConfigs.id, id)];
  if (tenantId) conditions.push(eq(slaConfigs.tenantId, tenantId));

  const existing = await db.select({ id: slaConfigs.id }).from(slaConfigs).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'SLA config not found or belongs to another tenant' } }, 403);
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.targetBps !== undefined) updates.targetBps = body.targetBps;
  if (body.measurementWindow !== undefined) updates.measurementWindow = body.measurementWindow;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(slaConfigs).set(updates).where(eq(slaConfigs.id, id));
  const updated = await db.select().from(slaConfigs).where(eq(slaConfigs.id, id)).all();
  return c.json(updated[0]);
});

// DELETE /sla/:id — delete SLA config (admin only)
slaRouter.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(slaConfigs.id, id)];
  if (tenantId) conditions.push(eq(slaConfigs.tenantId, tenantId));

  const existing = await db.select({ id: slaConfigs.id }).from(slaConfigs).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'SLA config not found or belongs to another tenant' } }, 403);
  }

  await db.delete(slaConfigs).where(eq(slaConfigs.id, id));
  return new Response(null, { status: 204 });
});

// GET /sla/:id/violations — list violations for an SLA config
slaRouter.get('/:id/violations', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  // Verify config ownership
  const configRows = await db.select({ id: slaConfigs.id, tenantId: slaConfigs.tenantId }).from(slaConfigs).where(eq(slaConfigs.id, id)).all();
  if (configRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `SLA config ${id} not found` } }, 404);
  }
  if (configRows[0].tenantId !== tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
  }

  const rows = await db
    .select()
    .from(slaViolations)
    .where(eq(slaViolations.slaConfigId, id))
    .all();

  return c.json(rows);
});

// PATCH /sla/violations/:id — acknowledge or resolve a violation
slaRouter.patch('/violations/:id', zValidator('json', UpdateViolationSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(slaViolations.id, id)];
  if (tenantId) conditions.push(eq(slaViolations.tenantId, tenantId));

  const existing = await db.select().from(slaViolations).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Violation not found or belongs to another tenant' } }, 403);
  }

  const { status } = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status };
  if (status === 'acknowledged') updates.acknowledgedAt = now;
  if (status === 'resolved') updates.resolvedAt = now;

  await db.update(slaViolations).set(updates).where(eq(slaViolations.id, id));
  const updated = await db.select().from(slaViolations).where(eq(slaViolations.id, id)).all();
  return c.json(updated[0]);
});

export { slaRouter };
