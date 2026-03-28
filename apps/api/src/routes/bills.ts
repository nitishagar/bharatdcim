import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { calculateBill } from '@bharatdcim/billing-engine';
import type { BillCalculationInput } from '@bharatdcim/billing-engine';
import type { AppEnv } from '../types.js';
import { bills, invoices, billDisputes } from '../db/schema.js';
import { requireAdmin } from '../middleware/rbac.js';
import { parsePagination } from '../utils/pagination.js';
import { CalculateBillSchema, CreateBillSchema } from '../schemas/bills.js';
import { validationHook } from '../utils/validationHook.js';

const CreateDisputeSchema = z.object({
  reason: z.string().min(1),
});

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
billsRouter.post('/calculate', zValidator('json', CalculateBillSchema, validationHook), async (c) => {
  const body = c.req.valid('json');

  const input: BillCalculationInput = {
    readings: body.readings as unknown as BillCalculationInput['readings'],
    tariff: body.tariff as unknown as BillCalculationInput['tariff'],
    contractedDemandKVA: body.contractedDemandKVA,
    recordedDemandKVA: body.recordedDemandKVA,
    powerFactor: body.powerFactor,
    dgKWh: body.dgKWh,
    dgRatePaisa: body.dgRatePaisa,
  };

  const result = calculateBill(input);
  return c.json(result);
});

// POST /bills — store a calculated bill (tenant from JWT, admin only)
billsRouter.post('/', zValidator('json', CreateBillSchema, validationHook), async (c) => {
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
    tenantId: tenantId,
    meterId: body.meterId,
    tariffId: body.tariffId,
    billingPeriodStart: body.billingPeriodStart,
    billingPeriodEnd: body.billingPeriodEnd,
    peakKwh: body.peakKwh,
    normalKwh: body.normalKwh,
    offPeakKwh: body.offPeakKwh,
    totalKwh: body.totalKwh,
    billedKvah: body.billedKvah ?? null,
    contractedDemandKva: body.contractedDemandKva,
    recordedDemandKva: body.recordedDemandKva,
    billedDemandKva: body.billedDemandKva,
    powerFactor: body.powerFactor,
    peakChargesPaisa: body.peakChargesPaisa,
    normalChargesPaisa: body.normalChargesPaisa,
    offPeakChargesPaisa: body.offPeakChargesPaisa,
    totalEnergyChargesPaisa: body.totalEnergyChargesPaisa,
    wheelingChargesPaisa: body.wheelingChargesPaisa,
    demandChargesPaisa: body.demandChargesPaisa,
    fuelAdjustmentPaisa: body.fuelAdjustmentPaisa,
    electricityDutyPaisa: body.electricityDutyPaisa,
    pfPenaltyPaisa: body.pfPenaltyPaisa,
    dgChargesPaisa: body.dgChargesPaisa,
    subtotalPaisa: body.subtotalPaisa,
    gstPaisa: body.gstPaisa,
    totalBillPaisa: body.totalBillPaisa,
    effectiveRatePaisaPerKwh: body.effectiveRatePaisaPerKwh,
    status: body.status,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(bills).values(row);
  return c.json(row, 201);
});

// POST /bills/:id/dispute — create a dispute for a bill (any tenant member or admin)
billsRouter.post('/:id/dispute', zValidator('json', CreateDisputeSchema, validationHook), async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(bills.id, id)];
  if (tenantId) conditions.push(eq(bills.tenantId, tenantId));
  const rows = await db.select({ id: bills.id, tenantId: bills.tenantId }).from(bills).where(and(...conditions)).all();
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: `Bill ${id} not found` } }, 404);
  }

  const { reason } = c.req.valid('json');
  const now = new Date().toISOString();
  const dispute = {
    id: crypto.randomUUID(),
    billId: id,
    tenantId: rows[0].tenantId,
    disputedBy: tenantId ?? 'unknown',
    reason,
    status: 'open' as const,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(billDisputes).values(dispute);
  return c.json(dispute, 201);
});

// GET /bills/:id/disputes — list disputes for a bill (tenant-scoped)
billsRouter.get('/:id/disputes', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const conditions = [eq(billDisputes.billId, id)];
  if (tenantId) conditions.push(eq(billDisputes.tenantId, tenantId));
  const rows = await db.select().from(billDisputes).where(and(...conditions)).all();
  return c.json(rows);
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
