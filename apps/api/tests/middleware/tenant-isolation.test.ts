import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { billsRouter } from '../../src/routes/bills.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { uploadsRouter } from '../../src/routes/uploads.js';
import { readingsRouter } from '../../src/routes/readings.js';
import { dashboardRouter } from '../../src/routes/dashboard.js';
import { tariffs as tariffsRouter } from '../../src/routes/tariffs.js';
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
  // Tenant-ka specific tariff (NOT global — tenantId is set)
  await (db as any).insert(tariffConfigs).values({
    id: 'tc-ka', tenantId: 'tenant-ka', stateCode: 'KA', discom: 'BESCOM', category: 'HT', effectiveFrom: '2025-01-01',
    billingUnit: 'kWh', baseEnergyRatePaisa: 660, wheelingChargePaisa: 0,
    demandChargePerKvaPaisa: 35000, demandRatchetPercent: 100, minimumDemandKva: 0,
    timeSlotsJson: '[]', fuelAdjustmentPaisa: 28, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 15,
    version: 1, createdAt: now, updatedAt: now,
  });
  // Invoice for tenant-ka (for cross-tenant cancel/credit-note tests)
  await (db as any).insert(invoices).values({
    id: 'inv-ka-1', billId: 'bill-ka-1', tenantId: 'tenant-ka', invoiceNumber: 'INV-2526-0002',
    financialYear: '2526', supplierGstin: '29AABCT1332E1ZP', recipientGstin: '29AADCB2230M1ZP',
    taxType: 'CGST_SGST', taxableAmountPaisa: 38750, cgstPaisa: 3488, sgstPaisa: 3488,
    totalTaxPaisa: 6975, totalAmountPaisa: 45725, status: 'finalized',
    invoiceDate: '2026-03-01', createdAt: now, updatedAt: now,
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

    it('tenant-ka sees only its invoices', async () => {
      const app = createAppWithTenant(db, 'tenant-ka');
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices');
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].tenantId).toBe('tenant-ka');
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
      expect(body.invoices.total).toBe(1);
    });
  });

  // ── New tenant isolation gaps ─────────────────────────────────────────────

  describe('TI-UPL-01: GET /uploads/:id cross-tenant', () => {
    it('returns 404 when tenant-mh requests a tenant-ka upload by ID', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/uploads', uploadsRouter);
      const res = await app.request('/uploads/up-ka-1');
      expect(res.status).toBe(404);
    });

    it('returns 200 when tenant-mh requests its own upload by ID', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/uploads', uploadsRouter);
      const res = await app.request('/uploads/up-mh-1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tenantId).toBe('tenant-mh');
    });
  });

  describe('TI-TAR-01/02: GET /tariffs/:id tenant vs global', () => {
    it('TI-TAR-01: returns 404 when tenant-mh requests tenant-ka specific tariff', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/tariffs', tariffsRouter);
      const res = await app.request('/tariffs/tc-ka');
      expect(res.status).toBe(404);
    });

    it('TI-TAR-02: returns 200 when tenant-mh requests a global tariff (tenant_id IS NULL)', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/tariffs', tariffsRouter);
      const res = await app.request('/tariffs/tc1');
      expect(res.status).toBe(200);
    });

    it('TI-TAR-02b: tenant-ka can access its own specific tariff', async () => {
      const app = createAppWithTenant(db, 'tenant-ka');
      app.route('/tariffs', tariffsRouter);
      const res = await app.request('/tariffs/tc-ka');
      expect(res.status).toBe(200);
    });
  });

  describe('TI-RDG-01: POST /readings cross-tenant meter check', () => {
    it('rejects readings referencing a meter belonging to a different tenant', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/readings', readingsRouter);
      const res = await app.request('/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [
            { id: 'r-bad-1', meterId: 'meter-ka-1', timestamp: '2026-03-01T00:00:00Z', kWh: 100 },
          ],
        }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('allows readings for own tenant meter', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/readings', readingsRouter);
      const res = await app.request('/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [
            { id: 'r-ok-1', meterId: 'meter-mh-1', timestamp: '2026-03-01T00:00:00Z', kWh: 100 },
          ],
        }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('TI-RDG-02: POST /readings/batch cross-tenant meter check', () => {
    it('rejects batch readings referencing a meter belonging to a different tenant', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/readings', readingsRouter);
      const res = await app.request('/readings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [
            { meter_id: 'meter-ka-1', timestamp: '2026-03-01T00:00:00Z', kwh: 100, kw: 10, pf: 0.95 },
          ],
        }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('api_token callers (no tenantId) can batch-insert without cross-tenant check', async () => {
      const app = createAppWithTenant(db, null, { authType: 'api_token' });
      app.route('/readings', readingsRouter);
      const res = await app.request('/readings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [
            { meter_id: 'meter-mh-1', timestamp: '2026-03-01T00:00:00Z', kwh: 50, kw: 5, pf: 0.9 },
          ],
        }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('TI-INV-01/02/03: Invoice service cross-tenant checks', () => {
    // TI-INV-01: createInvoice rejects bill from different tenant
    it('TI-INV-01: POST /invoices rejects bill belonging to different tenant', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: 'bill-ka-1',          // belongs to tenant-ka
          supplierGSTIN: '27AABCT1332E1ZT', // valid MH GSTIN (state 27)
          recipientGSTIN: '29AABCT1332E1ZP', // valid KA GSTIN (state 29)
        }),
      });
      // Should be rejected — bill belongs to tenant-ka, not tenant-mh
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toMatch(/not found/i);
    });

    // TI-INV-02: cancelInvoice rejects invoice from different tenant
    it('TI-INV-02: POST /invoices/:id/cancel rejects invoice belonging to different tenant', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices/inv-ka-1/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Duplicate' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toMatch(/not found/i);
    });

    // TI-INV-03: createCreditNote rejects invoice from different tenant
    it('TI-INV-03: POST /invoices/credit-notes rejects invoice belonging to different tenant', async () => {
      const app = createAppWithTenant(db, 'tenant-mh');
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'inv-ka-1',      // belongs to tenant-ka
          amountPaisa: 10000,
          reason: 'Overbilled',
        }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toMatch(/not found/i);
    });
  });
});
