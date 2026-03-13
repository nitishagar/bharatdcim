import { Hono } from 'hono';
import { eq, or, isNull, and } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { tariffConfigs, meters, bills } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';

const tariffs = new Hono<AppEnv>();

// GET /tariffs — list tariff configs (global + tenant-specific for tenant users)
tariffs.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');

  if (tenantId) {
    // Return global tariffs (tenantId IS NULL) + tenant-specific overrides
    const rows = await db.select().from(tariffConfigs)
      .where(or(isNull(tariffConfigs.tenantId), eq(tariffConfigs.tenantId, tenantId)))
      .all();
    return c.json(rows);
  }

  // API_TOKEN or platform admin — return all
  const rows = await db.select().from(tariffConfigs).all();
  return c.json(rows);
});

// GET /tariffs/:id — get tariff by ID (global tariffs or own tenant's tariffs)
tariffs.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const tenantId = c.get('tenantId');
  const conditions = [eq(tariffConfigs.id, id)];
  if (tenantId) {
    // Allow access to global tariffs (tenantId IS NULL) OR own tenant's tariffs
    conditions.push(or(isNull(tariffConfigs.tenantId), eq(tariffConfigs.tenantId, tenantId))!);
  }
  const rows = await db.select().from(tariffConfigs).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Tariff ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

// POST /tariffs — create tariff config (admin only)
tariffs.post('/', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const now = new Date().toISOString();

  if (!body.id || !body.stateCode || !body.baseEnergyRatePaisa) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: id, stateCode, baseEnergyRatePaisa' } },
      400,
    );
  }

  const row = {
    id: body.id as string,
    tenantId: tenantId ?? null, // tenant-specific if created by tenant, global if API_TOKEN
    stateCode: body.stateCode as string,
    discom: body.discom as string ?? '',
    category: body.category as string ?? '',
    effectiveFrom: body.effectiveFrom as string ?? now,
    effectiveTo: (body.effectiveTo as string) ?? null,
    billingUnit: body.billingUnit as string ?? 'kWh',
    baseEnergyRatePaisa: body.baseEnergyRatePaisa as number,
    wheelingChargePaisa: (body.wheelingChargePaisa as number) ?? 0,
    demandChargePerKvaPaisa: (body.demandChargePerKvaPaisa as number) ?? 0,
    demandRatchetPercent: (body.demandRatchetPercent as number) ?? 100,
    minimumDemandKva: (body.minimumDemandKva as number) ?? 0,
    timeSlotsJson: typeof body.timeSlotsJson === 'string' ? body.timeSlotsJson : JSON.stringify(body.timeSlots ?? []),
    fuelAdjustmentPaisa: (body.fuelAdjustmentPaisa as number) ?? 0,
    fuelAdjustmentType: body.fuelAdjustmentType as string ?? 'absolute',
    electricityDutyBps: (body.electricityDutyBps as number) ?? 0,
    pfThresholdBps: (body.pfThresholdBps as number) ?? 9000,
    pfPenaltyRatePaisa: (body.pfPenaltyRatePaisa as number) ?? 0,
    version: (body.version as number) ?? 1,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tariffConfigs).values(row);
  return c.json(row, 201);
});

// PATCH /tariffs/:id — update tariff fields (admin only)
tariffs.patch('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(tariffConfigs.id, id)];
  if (tenantId) {
    conditions.push(or(isNull(tariffConfigs.tenantId), eq(tariffConfigs.tenantId, tenantId))!);
  }
  const existing = await db.select({ id: tariffConfigs.id }).from(tariffConfigs).where(and(...conditions)).all();
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Tariff ${id} not found` } }, 404);
  }

  const body = await c.req.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.stateCode !== undefined) updates.stateCode = body.stateCode;
  if (body.discom !== undefined) updates.discom = body.discom;
  if (body.category !== undefined) updates.category = body.category;
  if (body.baseEnergyRatePaisa !== undefined) updates.baseEnergyRatePaisa = Number(body.baseEnergyRatePaisa);
  if (body.wheelingChargePaisa !== undefined) updates.wheelingChargePaisa = Number(body.wheelingChargePaisa);
  if (body.demandChargePerKvaPaisa !== undefined) updates.demandChargePerKvaPaisa = Number(body.demandChargePerKvaPaisa);
  if (body.effectiveFrom !== undefined) updates.effectiveFrom = body.effectiveFrom;
  if ('effectiveTo' in body) updates.effectiveTo = body.effectiveTo ?? null;
  if (body.billingUnit !== undefined) updates.billingUnit = body.billingUnit;

  await db.update(tariffConfigs).set(updates).where(eq(tariffConfigs.id, id));
  const updated = await db.select().from(tariffConfigs).where(eq(tariffConfigs.id, id)).all();
  return c.json(updated[0]);
});

// DELETE /tariffs/:id — hard-delete (admin only), refuse 409 if referenced
tariffs.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');

  const conditions = [eq(tariffConfigs.id, id)];
  if (tenantId) {
    conditions.push(or(isNull(tariffConfigs.tenantId), eq(tariffConfigs.tenantId, tenantId))!);
  }
  const rows = await db.select().from(tariffConfigs).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Tariff ${id} not found` } }, 404);
  }

  const linkedMeter = await db.select({ id: meters.id }).from(meters).where(eq(meters.tariffId, id)).limit(1).all();
  if (linkedMeter.length > 0) {
    return c.json({ error: { code: 'CONFLICT', message: 'Tariff is referenced by one or more meters' } }, 409);
  }
  const linkedBill = await db.select({ id: bills.id }).from(bills).where(eq(bills.tariffId, id)).limit(1).all();
  if (linkedBill.length > 0) {
    return c.json({ error: { code: 'CONFLICT', message: 'Tariff is referenced by one or more bills' } }, 409);
  }

  await db.delete(tariffConfigs).where(eq(tariffConfigs.id, id));
  return new Response(null, { status: 204 });
});

export { tariffs };
