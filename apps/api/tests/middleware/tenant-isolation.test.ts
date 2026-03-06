import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { billsRouter } from '../../src/routes/bills.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { uploadsRouter } from '../../src/routes/uploads.js';
import { readingsRouter } from '../../src/routes/readings.js';
import { dashboardRouter } from '../../src/routes/dashboard.js';
import { tenants, meters, tariffConfigs, bills, invoices, uploadAudit, powerReadings } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

async function seedTwoTenants(db: Database) {
  await (db as any).insert(tenants).values([
    { id: 'tenant-mh', name: 'Mumbai DC', stateCode: 'MH', createdAt: now, updatedAt: now },
    { id: 'tenant-ka', name: 'Bangalore DC', stateCode: 'KA', createdAt: now, updatedAt: now },
  ]);
  await (db as any).insert(tariffConfigs).values({
    id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2025-01-01',
    billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
    demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75, minimumDemandKva: 50,
    timeSlotsJson: '[]', fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20,
    version: 1, createdAt: now, updatedAt: now,
  });
  // Meters for tenant-mh
  await (db as any).insert(meters).values([
    { id: 'meter-mh-1', tenantId: 'tenant-mh', name: 'Mumbai Grid', stateCode: 'MH', tariffId: 'tc1', createdAt: now, updatedAt: now },
    { id: 'meter-mh-2', tenantId: 'tenant-mh', name: 'Mumbai DG', stateCode: 'MH', tariffId: 'tc1', createdAt: now, updatedAt: now },
  ]);
  // Meters for tenant-ka
  await (db as any).insert(meters).values([
    { id: 'meter-ka-1', tenantId: 'tenant-ka', name: 'Bangalore Grid', stateCode: 'KA', tariffId: 'tc1', createdAt: now, updatedAt: now },
  ]);
  // Bills for tenant-mh
  await (db as any).insert(bills).values({
    id: 'bill-mh-1', tenantId: 'tenant-mh', meterId: 'meter-mh-1', tariffId: 'tc1',
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
  // Bills for tenant-ka
  await (db as any).insert(bills).values({
    id: 'bill-ka-1', tenantId: 'tenant-ka', meterId: 'meter-ka-1', tariffId: 'tc1',
    billingPeriodStart: '2026-02-01', billingPeriodEnd: '2026-02-28',
    peakKwh: 50, normalKwh: 100, offPeakKwh: 25, totalKwh: 175,
    contractedDemandKva: 50, recordedDemandKva: 40, billedDemandKva: 40,
    powerFactor: 9800, peakChargesPaisa: 5000, normalChargesPaisa: 8000,
    offPeakChargesPaisa: 1500, totalEnergyChargesPaisa: 14500,
    wheelingChargesPaisa: 2500, demandChargesPaisa: 20000,
    fuelAdjustmentPaisa: 1000, electricityDutyPaisa: 750, pfPenaltyPaisa: 0,
    dgChargesPaisa: 0, subtotalPaisa: 38750, gstPaisa: 6975,
    totalBillPaisa: 45725, effectiveRatePaisaPerKwh: 261, status: 'draft',
    createdAt: now, updatedAt: now,
  });
  // Invoices
  await (db as any).insert(invoices).values({
    id: 'inv-mh-1', billId: 'bill-mh-1', tenantId: 'tenant-mh', invoiceNumber: 'INV-2526-0001',
    financialYear: '2526', supplierGstin: '27AABCT1234F1ZH', recipientGstin: '27AABCT5678G1ZK',
    taxType: 'CGST_SGST', taxableAmountPaisa: 77500, cgstPaisa: 6975, sgstPaisa: 6975,
    totalTaxPaisa: 13950, totalAmountPaisa: 91450, status: 'finalized',
    invoiceDate: '2026-02-01', createdAt: now, updatedAt: now,
  });
  // Upload audit
  await (db as any).insert(uploadAudit).values([
    {
      id: 'up-mh-1', tenantId: 'tenant-mh', fileName: 'mh-data.csv', fileSize: 1024,
      format: 'bharatdcim', totalRows: 10, importedRows: 10, skippedRows: 0,
      processingTimeMs: 50, createdAt: now,
    },
    {
      id: 'up-ka-1', tenantId: 'tenant-ka', fileName: 'ka-data.csv', fileSize: 512,
      format: 'bharatdcim', totalRows: 5, importedRows: 5, skippedRows: 0,
      processingTimeMs: 30, createdAt: now,
    },
  ]);
  // Power readings
  await (db as any).insert(powerReadings).values([
    { id: 'pr-mh-1', meterId: 'meter-mh-1', timestamp: '2026-01-15T10:00:00Z', createdAt: now },
    { id: 'pr-ka-1', meterId: 'meter-ka-1', timestamp: '2026-02-15T10:00:00Z', createdAt: now },
  ]);
}

describe('Tenant Isolation', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedTwoTenants(db);
  });

  describe('GET /meters', () => {
    it('tenant-mh sees only its meters', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/meters', metersRouter);
      const res = await app.request('/meters');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      expect(body.every((m: { tenantId: string }) => m.tenantId === 'tenant-mh')).toBe(true);
    });

    it('tenant-ka sees only its meters', async () => {
      const app = createAppWithTenant(db, 'tenant-ka');
      app.route('/meters', metersRouter);
      const res = await app.request('/meters');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].tenantId).toBe('tenant-ka');
    });

    it('API_TOKEN with no tenant returns empty', async () => {
      const app = createAppWithTenant(db, null, { authType: 'api_token' });
      app.route('/meters', metersRouter);
      const res = await app.request('/meters');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });
  });

  describe('GET /meters/:id', () => {
    it('tenant-mh can access its own meter', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/meters', metersRouter);
      const res = await app.request('/meters/meter-mh-1');
      expect(res.status).toBe(200);
    });

    it('tenant-mh cannot access tenant-ka meter', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/meters', metersRouter);
      const res = await app.request('/meters/meter-ka-1');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /meters', () => {
    it('uses JWT tenant, ignores body tenantId', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/meters', metersRouter);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'meter-new', tenantId: 'tenant-ka', name: 'New Meter', stateCode: 'MH',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.tenantId).toBe('tenant-mh'); // JWT tenant, NOT body tenant
    });

    it('API_TOKEN cannot create meters (no tenant context)', async () => {
      const app = createAppWithTenant(db, null, { authType: 'api_token' });
      app.route('/meters', metersRouter);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'meter-new', name: 'New', stateCode: 'MH' }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /bills', () => {
    it('tenant-mh sees only its bills', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/bills', billsRouter);
      const res = await app.request('/bills');
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].tenantId).toBe('tenant-mh');
    });

    it('tenant-ka sees only its bills', async () => {
      const app = createAppWithTenant(db, 'tenant-ka');
      app.route('/bills', billsRouter);
      const res = await app.request('/bills');
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].tenantId).toBe('tenant-ka');
    });
  });

  describe('GET /invoices', () => {
    it('tenant-mh sees its invoices', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices');
      const body = await res.json();
      expect(body).toHaveLength(1);
    });

    it('tenant-ka sees no invoices', async () => {
      const app = createAppWithTenant(db, 'tenant-ka');
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices');
      const body = await res.json();
      expect(body).toHaveLength(0);
    });
  });

  describe('GET /uploads', () => {
    it('tenant-mh sees only its uploads', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/uploads', uploadsRouter);
      const res = await app.request('/uploads');
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].tenantId).toBe('tenant-mh');
    });
  });

  describe('GET /readings', () => {
    it('tenant-mh can read its own meter readings', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/readings', readingsRouter);
      const res = await app.request('/readings?meter_id=meter-mh-1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
    });

    it('tenant-mh cannot read tenant-ka meter readings', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/readings', readingsRouter);
      const res = await app.request('/readings?meter_id=meter-ka-1');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /dashboard/summary', () => {
    it('tenant-mh sees only its counts', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/dashboard', dashboardRouter);
      const res = await app.request('/dashboard/summary');
      const body = await res.json();
      expect(body.meters.total).toBe(2);
      expect(body.bills.total).toBe(1);
      expect(body.invoices.total).toBe(1);
    });

    it('tenant-ka sees only its counts', async () => {
      const app = createAppWithTenant(db, 'tenant-ka');
      app.route('/dashboard', dashboardRouter);
      const res = await app.request('/dashboard/summary');
      const body = await res.json();
      expect(body.meters.total).toBe(1);
      expect(body.bills.total).toBe(1);
      expect(body.invoices.total).toBe(0);
    });
  });
});
