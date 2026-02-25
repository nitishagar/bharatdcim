import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb } from '../helpers.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { tenants, meters, tariffConfigs, bills, invoices } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

function createApp(db: Database) {
  const app = new Hono<{ Variables: { db: Database } }>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });
  app.route('/invoices', invoicesRouter);
  return app;
}

const now = '2026-02-25T00:00:00Z';

async function seedInvoice(db: Database) {
  await (db as any).insert(tenants).values({
    id: 't1', name: 'Test Tenant', stateCode: 'MH', createdAt: now, updatedAt: now,
  });
  await (db as any).insert(tariffConfigs).values({
    id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2025-01-01',
    billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
    demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75, minimumDemandKva: 50,
    timeSlotsJson: '[]', fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20,
    version: 1, createdAt: now, updatedAt: now,
  });
  await (db as any).insert(meters).values({
    id: 'm1', tenantId: 't1', name: 'Meter 1', stateCode: 'MH', tariffId: 'tc1',
    createdAt: now, updatedAt: now,
  });
  await (db as any).insert(bills).values({
    id: 'b1', tenantId: 't1', meterId: 'm1', tariffId: 'tc1',
    billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
    peakKwh: 100, normalKwh: 200, offPeakKwh: 50, totalKwh: 350,
    contractedDemandKva: 100, recordedDemandKva: 80, billedDemandKva: 80,
    powerFactor: 9500, peakChargesPaisa: 10000, normalChargesPaisa: 16000,
    offPeakChargesPaisa: 3000, totalEnergyChargesPaisa: 29000,
    wheelingChargesPaisa: 5000, demandChargesPaisa: 40000,
    fuelAdjustmentPaisa: 2000, electricityDutyPaisa: 1500, pfPenaltyPaisa: 0,
    dgChargesPaisa: 0, subtotalPaisa: 77500, gstPaisa: 13950,
    totalBillPaisa: 91450, effectiveRatePaisaPerKwh: 261, status: 'finalized',
    createdAt: now, updatedAt: now,
  });
  await (db as any).insert(invoices).values({
    id: 'inv1', billId: 'b1', tenantId: 't1', invoiceNumber: 'INV-2526-0001',
    financialYear: '2526', supplierGstin: '27AABCT1234F1ZH',
    recipientGstin: '27AABCT5678G1ZK', taxType: 'CGST_SGST',
    taxableAmountPaisa: 77500, cgstPaisa: 6975, sgstPaisa: 6975,
    totalTaxPaisa: 13950, totalAmountPaisa: 91450, status: 'finalized',
    invoiceDate: '2026-02-01', createdAt: now, updatedAt: now,
  });
}

describe('GET /invoices', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createApp(db);
  });

  it('returns empty array when no invoices', async () => {
    const res = await app.request('/invoices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns invoices after insertion', async () => {
    await seedInvoice(db);
    const res = await app.request('/invoices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].invoiceNumber).toBe('INV-2526-0001');
    expect(body[0].totalAmountPaisa).toBe(91450);
  });
});
