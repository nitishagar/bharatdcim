import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { powerReadings, meters } from '../db/schema.js';
import { parsePagination } from '../utils/pagination.js';
import { CreateReadingsSchema, BatchReadingsSchema } from '../schemas/readings.js';
import { validationHook } from '../utils/validationHook.js';

const readingsRouter = new Hono<AppEnv>();

// GET /readings?meter_id=&from=&to= — query readings (verify meter belongs to tenant)
readingsRouter.get('/', async (c) => {
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

  const { hasPagination, limit, offset } = parsePagination(c);

  const conditions = [eq(powerReadings.meterId, meterId)];
  if (from) conditions.push(gte(powerReadings.timestamp, from));
  if (to) conditions.push(lte(powerReadings.timestamp, to));
  const where = and(...conditions);

  if (!hasPagination) {
    const rows = await db.select().from(powerReadings).where(where).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(powerReadings).where(where).all();
  const data = await db.select().from(powerReadings).where(where).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

// POST /readings — batch insert readings
readingsRouter.post('/', zValidator('json', CreateReadingsSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');

  // Verify all referenced meters belong to the caller's tenant
  if (tenantId) {
    const meterIds = [...new Set(body.readings.map((r) => r.meterId))];
    for (const meterId of meterIds) {
      const meterRows = await db.select({ tenantId: meters.tenantId })
        .from(meters).where(eq(meters.id, meterId)).all();
      if (meterRows.length === 0 || meterRows[0].tenantId !== tenantId) {
        return c.json(
          { error: { code: 'FORBIDDEN', message: `Meter ${meterId} does not belong to your tenant` } },
          403,
        );
      }
    }
  }

  const now = new Date().toISOString();
  const rows = body.readings.map((r) => ({
    id: r.id,
    meterId: r.meterId,
    timestamp: r.timestamp,
    kWh: r.kWh ?? null,
    kW: r.kW ?? null,
    voltage: r.voltage ?? null,
    current: r.current ?? null,
    powerFactor: r.powerFactor ?? null,
    source: r.source ?? null,
    slotType: r.slotType ?? null,
    slotName: r.slotName ?? null,
    ratePaisa: r.ratePaisa ?? null,
    uploadId: r.uploadId ?? null,
    createdAt: now,
  }));

  // Batch insert in chunks of 500
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(powerReadings).values(batch);
  }

  return c.json({ inserted: rows.length }, 201);
});

// POST /readings/batch — SNMP agent batch upload format
readingsRouter.post('/batch', zValidator('json', BatchReadingsSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = c.req.valid('json');

  const meterIds = [...new Set(body.readings.map((r) => (r.meter_id || r.meterId) as string))];

  // Defense-in-depth: verify all meter IDs exist (applies to all callers including api_token)
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

  // Verify all referenced meters belong to the caller's tenant (skipped for api_token callers)
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
  const rows = body.readings.map((r) => ({
    id: crypto.randomUUID(),
    meterId: (r.meter_id || r.meterId) as string,
    timestamp: r.timestamp,
    kWh: r.kWh != null ? Math.round(r.kWh * 1000) : null, // Convert kWh to paisa-equiv
    kW: r.kW != null ? Math.round(r.kW * 1000) : null,    // Convert kW to milliwatts
    powerFactor: r.powerFactor != null ? Math.round(r.powerFactor * 10000) : null, // to BPS
    source: 'snmp' as const,
    createdAt: now,
  }));

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(powerReadings).values(batch);
  }

  return c.json({ accepted: rows.length, agentId: body.agentId || body.agent_id || null }, 201);
});

export { readingsRouter };
