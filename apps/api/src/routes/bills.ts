import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { calculateBill } from '@bharatdcim/billing-engine';
import type { BillCalculationInput } from '@bharatdcim/billing-engine';
import type { AppEnv } from '../types.js';
import { bills, invoices } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';

const billsRouter = new Hono<AppEnv>();

// GET /bills — list bills (scoped by tenant)
billsRouter.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) return c.json([]);

  const { hasPagination, limit, offset } = parsePagination(c);
  const where = eq(bills.tenantId, tenantId);

  if (!hasPagination) {
    const rows = await db.select().from(bills).where(where).all();
    return c.json(rows);
  }

  const [{ total }] = await db.select({ total: sql<number>`COUNT(*)` }).from(bills).where(where).all();
  const data = await db.select().from(bills).where(where).limit(limit).offset(offset).all();
  return c.json({ data, total: Number(total), limit, offset });
});

// GET /bills/:id — get bill by ID (verify tenant ownership)
billsRouter.get('/:id', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(bills.id, id)];
  if (tenantId) conditions.push(eq(bills.tenantId, tenantId));
  const rows = await db.select().from(bills).where(and(...conditions)).all();
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

// POST /bills — store a calculated bill (tenant from JWT, admin only)
billsRouter.post('/', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  if (!tenantId) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Tenant context required' } }, 403);
  }
  const body = await c.req.json();
  const now = new Date().toISOString();

  if (!body.id || !body.meterId || !body.tariffId) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: id, meterId, tariffId' } },
      400,
    );
  }

  const row = {
    id: body.id as string,
    tenantId: tenantId,
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

// DELETE /bills/:id — hard-delete draft bill (admin only), refuse 422 if not draft or has invoice
billsRouter.delete('/:id', async (c) => {
  requireAdmin(c);
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(bills.id, id)];
  if (tenantId) conditions.push(eq(bills.tenantId, tenantId));
  const rows = await db.select().from(bills).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Bill ${id} not found` } }, 404);
  }

  const bill = rows[0];
  if (bill.status !== 'draft') {
    return c.json({ error: { code: 'UNPROCESSABLE_ENTITY', message: 'Only draft bills can be deleted' } }, 422);
  }
  const linkedInvoice = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.billId, id)).limit(1).all();
  if (linkedInvoice.length > 0) {
    return c.json({ error: { code: 'UNPROCESSABLE_ENTITY', message: 'Bill has an associated invoice and cannot be deleted' } }, 422);
  }

  await db.delete(bills).where(eq(bills.id, id));
  return new Response(null, { status: 204 });
});

export { billsRouter };
