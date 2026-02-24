import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { calculateBill } from '@bharatdcim/billing-engine';
import type { BillCalculationInput } from '@bharatdcim/billing-engine';
import type { Database } from '../db/client.js';
import { bills } from '../db/schema.js';

type Env = { Variables: { db: Database } };

const billsRouter = new Hono<Env>();

// GET /bills — list all bills
billsRouter.get('/', async (c) => {
  const db = c.get('db');
  const rows = await db.select().from(bills).all();
  return c.json(rows);
});

// GET /bills/:id — get bill by ID
billsRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const rows = await db.select().from(bills).where(eq(bills.id, id)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Bill ${id} not found` } }, 404);
  }
  return c.json(rows[0]);
});

// POST /bills/calculate — calculate bill from readings + tariff (stateless)
billsRouter.post('/calculate', async (c) => {
  const body = await c.req.json();

  if (!body.readings || !body.tariff) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: readings, tariff' } },
      400,
    );
  }

  const input: BillCalculationInput = {
    readings: body.readings,
    tariff: body.tariff,
    contractedDemandKVA: body.contractedDemandKVA ?? 0,
    recordedDemandKVA: body.recordedDemandKVA ?? 0,
    powerFactor: body.powerFactor ?? 1.0,
    dgKWh: body.dgKWh ?? 0,
    dgRatePaisa: body.dgRatePaisa ?? 0,
  };

  const result = calculateBill(input);
  return c.json(result);
});

// POST /bills — store a calculated bill
billsRouter.post('/', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();
  const now = new Date().toISOString();

  if (!body.id || !body.tenantId || !body.meterId || !body.tariffId) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: id, tenantId, meterId, tariffId' } },
      400,
    );
  }

  const row = {
    id: body.id as string,
    tenantId: body.tenantId as string,
    meterId: body.meterId as string,
    tariffId: body.tariffId as string,
    billingPeriodStart: body.billingPeriodStart as string,
    billingPeriodEnd: body.billingPeriodEnd as string,
    peakKwh: body.peakKwh as number,
    normalKwh: body.normalKwh as number,
    offPeakKwh: body.offPeakKwh as number,
    totalKwh: body.totalKwh as number,
    billedKvah: (body.billedKvah as number) ?? null,
    contractedDemandKva: body.contractedDemandKva as number,
    recordedDemandKva: body.recordedDemandKva as number,
    billedDemandKva: body.billedDemandKva as number,
    powerFactor: body.powerFactor as number,
    peakChargesPaisa: body.peakChargesPaisa as number,
    normalChargesPaisa: body.normalChargesPaisa as number,
    offPeakChargesPaisa: body.offPeakChargesPaisa as number,
    totalEnergyChargesPaisa: body.totalEnergyChargesPaisa as number,
    wheelingChargesPaisa: body.wheelingChargesPaisa as number,
    demandChargesPaisa: body.demandChargesPaisa as number,
    fuelAdjustmentPaisa: body.fuelAdjustmentPaisa as number,
    electricityDutyPaisa: body.electricityDutyPaisa as number,
    pfPenaltyPaisa: body.pfPenaltyPaisa as number,
    dgChargesPaisa: body.dgChargesPaisa as number,
    subtotalPaisa: body.subtotalPaisa as number,
    gstPaisa: body.gstPaisa as number,
    totalBillPaisa: body.totalBillPaisa as number,
    effectiveRatePaisaPerKwh: body.effectiveRatePaisaPerKwh as number,
    status: (body.status as string) ?? 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(bills).values(row);
  return c.json(row, 201);
});

export { billsRouter };
