import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, isNull } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { alertRules, alertEvents } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { CreateAlertRuleSchema, UpdateAlertRuleSchema } from '../schemas/alerts.js';
import { validationHook } from '../utils/validationHook.js';

const alertsRouter = new Hono<AppEnv>();

// GET /alerts — list unresolved alert events for tenant
alertsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const rows = await db.select().from(alertEvents)
    .where(and(eq(alertEvents.tenantId, tenantId), isNull(alertEvents.resolvedAt)))
    .all();
  return c.json(rows);
});

// POST /alerts/:id/resolve — resolve an alert event
alertsRouter.post('/:id/resolve', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const rows = await db.select().from(alertEvents).where(eq(alertEvents.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Alert ${id} not found` } }, 404);
  }

  if (tenantId && rows[0].tenantId !== tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  const now = new Date().toISOString();
  await db.update(alertEvents).set({ resolvedAt: now }).where(eq(alertEvents.id, id));

  const updated = await db.select().from(alertEvents).where(eq(alertEvents.id, id)).all();
  return c.json(updated[0]);
});

// GET /alerts/rules — list alert rules for tenant
alertsRouter.get('/rules', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const rows = await db.select().from(alertRules)
    .where(eq(alertRules.tenantId, tenantId))
    .all();
  return c.json(rows);
});

// POST /alerts/rules — create alert rule (admin only)
alertsRouter.post('/rules', zValidator('json', CreateAlertRuleSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();

  const row = {
    id: body.id,
    tenantId,
    meterId: body.meterId ?? null,
    metric: body.metric,
    operator: body.operator,
    threshold: body.threshold,
    severity: body.severity,
    enabled: 1 as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(alertRules).values(row);
  return c.json(row, 201);
});

// PATCH /alerts/rules/:id — update alert rule
alertsRouter.patch('/rules/:id', zValidator('json', UpdateAlertRuleSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const rows = await db.select().from(alertRules).where(eq(alertRules.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Alert rule ${id} not found` } }, 404);
  }

  if (tenantId && rows[0].tenantId !== tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.meterId !== undefined) updates.meterId = body.meterId;
  if (body.metric !== undefined) updates.metric = body.metric;
  if (body.operator !== undefined) updates.operator = body.operator;
  if (body.threshold !== undefined) updates.threshold = body.threshold;
  if (body.severity !== undefined) updates.severity = body.severity;
  if (body.enabled !== undefined) updates.enabled = body.enabled;

  await db.update(alertRules).set(updates).where(eq(alertRules.id, id));

  const updated = await db.select().from(alertRules).where(eq(alertRules.id, id)).all();
  return c.json(updated[0]);
});

// DELETE /alerts/rules/:id — remove alert rule
alertsRouter.delete('/rules/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const rows = await db.select().from(alertRules).where(eq(alertRules.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Alert rule ${id} not found` } }, 404);
  }

  if (tenantId && rows[0].tenantId !== tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
  }

  await db.delete(alertRules).where(eq(alertRules.id, id));
  return new Response(null, { status: 204 });
});

export { alertsRouter };
