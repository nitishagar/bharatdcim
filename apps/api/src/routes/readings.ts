import { Hono } from 'hono';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { powerReadings, meters } from '../db/schema.js';

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

  const conditions = [eq(powerReadings.meterId, meterId)];
  if (from) conditions.push(gte(powerReadings.timestamp, from));
  if (to) conditions.push(lte(powerReadings.timestamp, to));

  const rows = await db
    .select()
    .from(powerReadings)
    .where(and(...conditions))
    .all();

  return c.json(rows);
});

// POST /readings — batch insert readings
readingsRouter.post('/', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  if (!Array.isArray(body.readings) || body.readings.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Body must contain a non-empty readings array' } },
      400,
    );
  }

  const now = new Date().toISOString();
  const rows = (body.readings as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    meterId: r.meterId as string,
    timestamp: r.timestamp as string,
    kWh: (r.kWh as number) ?? null,
    kW: (r.kW as number) ?? null,
    voltage: (r.voltage as number) ?? null,
    current: (r.current as number) ?? null,
    powerFactor: (r.powerFactor as number) ?? null,
    source: (r.source as string) ?? null,
    slotType: (r.slotType as string) ?? null,
    slotName: (r.slotName as string) ?? null,
    ratePaisa: (r.ratePaisa as number) ?? null,
    uploadId: (r.uploadId as string) ?? null,
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
readingsRouter.post('/batch', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  if (!Array.isArray(body.readings) || body.readings.length === 0) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Body must contain a non-empty readings array' } },
      400,
    );
  }

  const now = new Date().toISOString();
  const rows = (body.readings as Array<Record<string, unknown>>).map((r) => ({
    id: crypto.randomUUID(),
    meterId: (r.meter_id || r.meterId) as string,
    timestamp: r.timestamp as string,
    kWh: r.kWh != null ? Math.round((r.kWh as number) * 1000) : null, // Convert kWh to paisa-equiv
    kW: r.kW != null ? Math.round((r.kW as number) * 1000) : null,    // Convert kW to milliwatts
    powerFactor: r.powerFactor != null ? Math.round((r.powerFactor as number) * 10000) : null, // to BPS
    source: 'snmp' as const,
    createdAt: now,
  }));

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.insert(powerReadings).values(batch);
  }

  return c.json({ accepted: rows.length, agentId: body.agentId || body.agent_id }, 201);
});

export { readingsRouter };
