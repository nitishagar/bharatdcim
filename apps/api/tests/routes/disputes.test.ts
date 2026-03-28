import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { billsRouter } from '../../src/routes/bills.js';
import { tenants, tariffConfigs, meters, bills } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-01-01T00:00:00Z';

const minimalBill = {
  id: 'bill-001',
  tenantId: 'tenant-1',
  meterId: 'meter-001',
  tariffId: 'tariff-001',
  billingPeriodStart: '2026-01-01',
  billingPeriodEnd: '2026-01-31',
  peakKwh: 0, normalKwh: 0, offPeakKwh: 0, totalKwh: 0,
  contractedDemandKva: 0, recordedDemandKva: 0, billedDemandKva: 0,
  powerFactor: 9000,
  peakChargesPaisa: 0, normalChargesPaisa: 0, offPeakChargesPaisa: 0,
  totalEnergyChargesPaisa: 0, wheelingChargesPaisa: 0, demandChargesPaisa: 0,
  fuelAdjustmentPaisa: 0, electricityDutyPaisa: 0, pfPenaltyPaisa: 0,
  dgChargesPaisa: 0, subtotalPaisa: 0, gstPaisa: 0, totalBillPaisa: 0,
  effectiveRatePaisaPerKwh: 0,
  status: 'draft',
  createdAt: now, updatedAt: now,
};

describe('POST /bills/:id/dispute', () => {
  let db: Database;
  let adminApp: ReturnType<typeof createAppWithTenant>;
  let memberApp: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    adminApp = createAppWithTenant(db, 'tenant-1');
    adminApp.route('/bills', billsRouter);
    memberApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
    memberApp.route('/bills', billsRouter);

    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now });
    await (db as any).insert(tariffConfigs).values({
      id: 'tariff-001', stateCode: 'MH', discom: 'MSEDCL', category: 'HT I',
      effectiveFrom: now, billingUnit: 'kWh', baseEnergyRatePaisa: 868,
      wheelingChargePaisa: 0, demandChargePerKvaPaisa: 0, demandRatchetPercent: 100,
      minimumDemandKva: 0, timeSlotsJson: '[]', fuelAdjustmentPaisa: 0,
      fuelAdjustmentType: 'absolute', electricityDutyBps: 0, pfThresholdBps: 9000,
      pfPenaltyRatePaisa: 0, version: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-001', tenantId: 'tenant-1', name: 'Grid Meter', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });
    await (db as any).insert(bills).values(minimalBill);
  });

  it('org:admin POST /bills/:id/dispute → 201 with dispute record', async () => {
    const res = await adminApp.request('/bills/bill-001/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Incorrect demand reading' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.billId).toBe('bill-001');
    expect(body.status).toBe('open');
    expect(body.reason).toBe('Incorrect demand reading');
  });

  it('org:member POST /bills/:id/dispute → 201 (members can also dispute)', async () => {
    const res = await memberApp.request('/bills/bill-001/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Bill amount too high' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('open');
  });

  it('POST /bills/:id/dispute with unknown bill_id → 404', async () => {
    const res = await adminApp.request('/bills/nonexistent/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /bills/:id/dispute for other tenant bill → 404 (tenant isolation)', async () => {
    const otherTenantApp = createAppWithTenant(db, 'tenant-2');
    otherTenantApp.route('/bills', billsRouter);
    const res = await otherTenantApp.request('/bills/bill-001/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test' }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /bills/:id/disputes → 200 with list of disputes', async () => {
    // Create a dispute first
    await adminApp.request('/bills/bill-001/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Test dispute' }),
    });
    const res = await adminApp.request('/bills/bill-001/disputes');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].reason).toBe('Test dispute');
  });
});
