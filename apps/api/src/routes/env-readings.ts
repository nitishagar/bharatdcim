import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { envReadings, alertRules, alertEvents, meters } from '../db/schema.js';
import { BatchEnvReadingsSchema } from '../schemas/env-readings.js';
import { validationHook } from '../utils/validationHook.js';

const envReadingsRouter = new Hono<AppEnv>();

// GET /env-readings/latest — most recent reading per meter (tenant-scoped)
envReadingsRouter.get('/latest', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  // Get meter IDs for this tenant
  const tenantMeters = tenantId
    ? await db.select({ id: meters.id }).from(meters).where(eq(meters.tenantId, tenantId)).all()
    : [];
  const meterIds = tenantMeters.map((m) => m.id);
  if (meterIds.length === 0) return c.json([]);

  // Latest reading per meter via subquery
  const latest = await db.select().from(envReadings)
    .where(inArray(envReadings.meterId, meterIds))
    .orderBy(sql`${envReadings.timestamp} DESC`)
    .all();

  // Deduplicate: keep only the first (latest) row per meterId
  const seen = new Set<string>();
  const result = latest.filter((r) => {
    if (seen.has(r.meterId)) return false;
    seen.add(r.meterId);
    return true;
  });

  return c.json(result);
});

// GET /env-readings?meter_id=&from=&to= — time-series query
envReadingsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const meterId = c.req.query('meter_id');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (!meterId) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Query parameter meter_id is required' } },
      400,
    );
  }

  // Verify meter belongs to tenant
  if (tenantId) {
    const meterRows = await db.select().from(meters)
      .where(and(eq(meters.id, meterId), eq(meters.tenantId, tenantId))).all();
    if (meterRows.length === 0) {
      return c.json(
        { error: { code: 'FORBIDDEN', message: `Meter ${meterId} not found or not accessible` } },
        403,
      );
    }
  }

  const conditions = [eq(envReadings.meterId, meterId)];
  if (from) conditions.push(gte(envReadings.timestamp, from));
  if (to) conditions.push(lte(envReadings.timestamp, to));

  const rows = await db.select().from(envReadings).where(and(...conditions)).all();
  return c.json(rows);
});

// POST /env-readings/batch — SNMP agent batch upload
envReadingsRouter.post('/batch', zValidator('json', BatchEnvReadingsSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');

  const meterIds = [...new Set(body.map((r) => r.meter_id))];

  // Verify all meter IDs exist
  const existingMeters = await db.select({ id: meters.id, tenantId: meters.tenantId })
    .from(meters).where(inArray(meters.id, meterIds)).all();
  const existingIds = new Set(existingMeters.map((m) => m.id));
  const missingIds = meterIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: `Unknown meter IDs: ${missingIds.join(', ')}` } },
      400,
    );
  }

  // Verify meters belong to caller's tenant
  if (tenantId) {
    for (const meter of existingMeters) {
      if (meter.tenantId !== tenantId) {
        return c.json(
          { error: { code: 'FORBIDDEN', message: `Meter ${meter.id} does not belong to your tenant` } },
          403,
        );
      }
    }
  }

  const now = new Date().toISOString();
  const rows = body.map((r) => ({
    id: crypto.randomUUID(),
    meterId: r.meter_id,
    timestamp: r.timestamp,
    tempCTenths: r.temp_c != null ? Math.round(r.temp_c * 10) : null,
    humidityPctTenths: r.humidity != null ? Math.round(r.humidity * 10) : null,
    source: 'snmp' as const,
    createdAt: now,
  }));

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(envReadings).values(rows.slice(i, i + batchSize));
  }

  // Alert breach detection — check enabled rules for the affected meters/tenant
  const effectiveTenantId = tenantId ?? (existingMeters[0]?.tenantId ?? null);
  if (effectiveTenantId) {
    const rulesConditions = [
      eq(alertRules.tenantId, effectiveTenantId),
      eq(alertRules.enabled, 1),
    ];
    const rules = await db.select().from(alertRules).where(and(...rulesConditions)).all();

    if (rules.length > 0) {
      const breachEvents: (typeof alertEvents.$inferInsert)[] = [];

      for (const row of rows) {
        for (const rule of rules) {
          // Skip if rule is scoped to a different meter
          if (rule.meterId && rule.meterId !== row.meterId) continue;

          const value = rule.metric === 'temperature' ? row.tempCTenths : row.humidityPctTenths;
          if (value == null) continue;

          const breached = checkOperator(rule.operator, value, rule.threshold);
          if (breached) {
            breachEvents.push({
              id: crypto.randomUUID(),
              tenantId: effectiveTenantId,
              ruleId: rule.id,
              meterId: row.meterId,
              value,
              threshold: rule.threshold,
              severity: rule.severity,
              triggeredAt: row.timestamp,
              resolvedAt: null,
              createdAt: now,
            });
          }
        }
      }

      if (breachEvents.length > 0) {
        for (let i = 0; i < breachEvents.length; i += batchSize) {
          await db.insert(alertEvents).values(breachEvents.slice(i, i + batchSize));
        }
      }
    }
  }

  return c.json({ inserted: rows.length }, 201);
});

function checkOperator(operator: string, value: number, threshold: number): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    default: return false;
  }
}

export { envReadingsRouter };
