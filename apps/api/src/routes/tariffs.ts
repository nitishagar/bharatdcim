import { Hono } from 'hono';
import { eq, or, isNull } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { tariffConfigs } from '../db/schema.js';
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

// GET /tariffs/:id — get tariff by ID
tariffs.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db.select().from(tariffConfigs).where(eq(tariffConfigs.id, id)).all();
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

export { tariffs };
