import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { capacityThresholds, meters, powerReadings, alerts } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { validationHook } from '../utils/validationHook.js';
import {
  CreateThresholdSchema,
  UpdateThresholdSchema,
  ForecastQuerySchema,
  AlertsQuerySchema,
  UpdateAlertSchema,
} from '../schemas/capacity.js';
import { aggregateByDay, fitLinearRegression, projectBreachDate } from '../services/capacity-math.js';

const capacityRouter = new Hono<AppEnv>();

// ─── Thresholds ────────────────────────────────────────────────

// POST /capacity/thresholds
capacityRouter.post('/thresholds', zValidator('json', CreateThresholdSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }

  const body = c.req.valid('json');

  // Verify meter belongs to this tenant
  const meterRows = await db.select({ id: meters.id }).from(meters).where(
    and(eq(meters.id, body.meterId), eq(meters.tenantId, tenantId))
  ).all();
  if (meterRows.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Meter not found or belongs to another tenant' } }, 403);
  }

  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    tenantId,
    meterId: body.meterId,
    metric: body.metric,
    warningValue: body.warningValue,
    criticalValue: body.criticalValue,
    windowDays: body.windowDays ?? 30,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(capacityThresholds).values(row);
  return c.json(row, 201);
});

// GET /capacity/thresholds
capacityRouter.get('/thresholds', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const meterId = c.req.query('meter_id');
  const conditions = [eq(capacityThresholds.tenantId, tenantId)];
  if (meterId) conditions.push(eq(capacityThresholds.meterId, meterId));

  const rows = await db.select().from(capacityThresholds).where(and(...conditions)).all();
  return c.json(rows);
});

// PATCH /capacity/thresholds/:id
capacityRouter.patch('/thresholds/:id', zValidator('json', UpdateThresholdSchema, validationHook), async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(capacityThresholds.id, id)];
  if (tenantId) conditions.push(eq(capacityThresholds.tenantId, tenantId));

  const existing = await db.select().from(capacityThresholds).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Threshold not found or belongs to another tenant' } }, 403);
  }

  const body = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.warningValue !== undefined) updates.warningValue = body.warningValue;
  if (body.criticalValue !== undefined) updates.criticalValue = body.criticalValue;
  if (body.windowDays !== undefined) updates.windowDays = body.windowDays;
  if (body.status !== undefined) updates.status = body.status;

  await db.update(capacityThresholds).set(updates).where(eq(capacityThresholds.id, id));
  const updated = await db.select().from(capacityThresholds).where(eq(capacityThresholds.id, id)).all();
  return c.json(updated[0]);
});

// DELETE /capacity/thresholds/:id
capacityRouter.delete('/thresholds/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(capacityThresholds.id, id)];
  if (tenantId) conditions.push(eq(capacityThresholds.tenantId, tenantId));

  const existing = await db.select({ id: capacityThresholds.id }).from(capacityThresholds).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Threshold not found or belongs to another tenant' } }, 403);
  }

  await db.delete(capacityThresholds).where(eq(capacityThresholds.id, id));
  return new Response(null, { status: 204 });
});

// ─── Forecast ─────────────────────────────────────────────────

// GET /capacity/forecast
capacityRouter.get('/forecast', zValidator('query', ForecastQuerySchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const { meter_id: meterId } = c.req.valid('query');

  // Verify meter belongs to this tenant
  const meterRows = await db.select({ id: meters.id }).from(meters).where(
    and(eq(meters.id, meterId), eq(meters.tenantId, tenantId!))
  ).all();
  if (meterRows.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Meter not found or belongs to another tenant' } }, 403);
  }

  // Fetch all readings for the meter and aggregate
  const readings = await db
    .select({ timestamp: powerReadings.timestamp, kWh: powerReadings.kWh, kW: powerReadings.kW })
    .from(powerReadings)
    .where(eq(powerReadings.meterId, meterId))
    .all();

  const dailyAggregates = aggregateByDay(readings);

  if (dailyAggregates.length === 0) {
    const thresholds = await db.select().from(capacityThresholds).where(
      and(eq(capacityThresholds.tenantId, tenantId!), eq(capacityThresholds.meterId, meterId))
    ).all();
    return c.json({ dailyAggregates: [], trendSlope: 0, r2: 0, projectedBreachAt: null, thresholds });
  }

  // Build regression points using day index as x
  const startDate = dailyAggregates[0].date;
  const points = dailyAggregates.map((d, i) => ({ x: i, y: d.totalKwh }));
  const regression = fitLinearRegression(points);

  // Find earliest projected breach across active thresholds
  const thresholds = await db.select().from(capacityThresholds).where(
    and(
      eq(capacityThresholds.tenantId, tenantId!),
      eq(capacityThresholds.meterId, meterId),
      eq(capacityThresholds.status, 'active'),
    )
  ).all();

  let projectedBreachAt: string | null = null;
  for (const t of thresholds) {
    const breach = projectBreachDate(regression, t.criticalValue, startDate);
    if (breach && (!projectedBreachAt || breach < projectedBreachAt)) {
      projectedBreachAt = breach;
    }
  }

  return c.json({
    dailyAggregates,
    trendSlope: regression.slope,
    r2: regression.r2,
    projectedBreachAt,
    thresholds,
  });
});

// ─── Alerts ───────────────────────────────────────────────────

// GET /capacity/alerts
capacityRouter.get('/alerts', zValidator('query', AlertsQuerySchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const { meter_id: meterId, status } = c.req.valid('query');

  const conditions = [
    eq(alerts.tenantId, tenantId),
  ];
  if (meterId) conditions.push(eq(alerts.meterId, meterId));
  if (status) conditions.push(eq(alerts.status, status));

  const rows = await db.select().from(alerts).where(and(...conditions)).all();
  return c.json(rows);
});

// PATCH /capacity/alerts/:id
capacityRouter.patch('/alerts/:id', zValidator('json', UpdateAlertSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(alerts.id, id)];
  if (tenantId) conditions.push(eq(alerts.tenantId, tenantId));

  const existing = await db.select().from(alerts).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Alert not found or belongs to another tenant' } }, 403);
  }

  const { status } = c.req.valid('json');
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updatedAt: now };
  if (status === 'acknowledged') updates.acknowledgedAt = now;
  if (status === 'resolved') updates.resolvedAt = now;

  await db.update(alerts).set(updates).where(eq(alerts.id, id));
  const updated = await db.select().from(alerts).where(eq(alerts.id, id)).all();
  return c.json(updated[0]);
});

export { capacityRouter };
