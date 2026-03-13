import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { billsRouter } from '../../src/routes/bills.js';
import { tenants, tariffConfigs, meters, bills } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

// For the /bills/calculate endpoint, we don't need a real DB
function createApp() {
  const app = createAppWithTenant({} as Database, 'tenant-1');
  app.route('/bills', billsRouter);
  return app;
}

describe('Bills Routes', () => {
  const app = createApp();

  it('POST /bills/calculate — stateless bill calculation', async () => {
    const input = {
      readings: [
        { timestamp: '2026-02-15T10:00:00Z', kWh: 100, slotName: 'Morning Peak', slotType: 'peak', ratePaisa: 948 },
        { timestamp: '2026-02-15T14:00:00Z', kWh: 200, slotName: 'Solar Hours', slotType: 'normal', ratePaisa: 868 },
        { timestamp: '2026-02-15T23:00:00Z', kWh: 50, slotName: 'Night Off-Peak', slotType: 'off-peak', ratePaisa: 718 },
      ],
      tariff: {
        id: 'mh-htia-2025',
        stateCode: 'MH',
        discom: 'MSEDCL / MERC',
        category: 'HT I(A)',
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
        billingUnit: 'kVAh',
        baseEnergyRatePaisa: 868,
        wheelingChargePaisa: 74,
        demandChargePerKVAPaisa: 60000,
        demandRatchetPercent: 75,
        minimumDemandKVA: 50,
        timeSlots: [],
        fuelAdjustmentPaisa: 72,
        fuelAdjustmentType: 'absolute',
        electricityDutyBps: 930,
        pfThresholdBps: 9000,
        pfPenaltyRatePaisa: 25,
        version: 1,
      },
      contractedDemandKVA: 400,
      recordedDemandKVA: 380,
      powerFactor: 0.95,
      dgKWh: 0,
      dgRatePaisa: 2200,
    };

    const res = await app.request('/bills/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify bill output structure
    expect(body.totalKWh).toBe(350); // 100 + 200 + 50
    expect(body.peakKWh).toBe(100);
    expect(body.normalKWh).toBe(200);
    expect(body.offPeakKWh).toBe(50);
    expect(body.totalBillPaisa).toBeGreaterThan(0);
    expect(body.totalBillPaisa).toBe(body.subtotalPaisa + body.gstPaisa);
    expect(body.billedKVAh).toBeGreaterThan(350); // kVAh state, PF < 1
    expect(body.billedDemandKVA).toBe(380); // max(380, 400*0.75=300, 50)
  });

  it('POST /bills/calculate — validation error on missing readings', async () => {
    const res = await app.request('/bills/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tariff: {} }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /bills/calculate — API matches billing engine direct call', async () => {
    // This verifies the API is a thin wrapper around the billing engine
    const { calculateBill } = await import('@bharatdcim/billing-engine');

    const readings = [
      { timestamp: '2026-02-15T07:00:00Z', kWh: 1000, slotName: 'Morning Normal', slotType: 'normal' as const, ratePaisa: 868 },
      { timestamp: '2026-02-15T19:00:00Z', kWh: 500, slotName: 'Evening Peak', slotType: 'peak' as const, ratePaisa: 978 },
    ];

    const tariff = {
      id: 'mh-htia-2025', stateCode: 'MH', discom: 'MSEDCL', category: 'HT I(A)',
      effectiveFrom: '2025-01-01', effectiveTo: null, billingUnit: 'kVAh' as const,
      baseEnergyRatePaisa: 868, wheelingChargePaisa: 74, demandChargePerKVAPaisa: 60000,
      demandRatchetPercent: 75, minimumDemandKVA: 50,
      timeSlots: [], fuelAdjustmentPaisa: 72, fuelAdjustmentType: 'absolute' as const,
      electricityDutyBps: 930, pfThresholdBps: 9000, pfPenaltyRatePaisa: 25, version: 1,
    };

    const directResult = calculateBill({
      readings, tariff, contractedDemandKVA: 400, recordedDemandKVA: 380,
      powerFactor: 0.95, dgKWh: 0, dgRatePaisa: 0,
    });

    const res = await app.request('/bills/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readings, tariff, contractedDemandKVA: 400, recordedDemandKVA: 380,
        powerFactor: 0.95, dgKWh: 0, dgRatePaisa: 0,
      }),
    });
    const apiResult = await res.json();

    expect(apiResult.totalBillPaisa).toBe(directResult.totalBillPaisa);
    expect(apiResult.totalEnergyChargesPaisa).toBe(directResult.totalEnergyChargesPaisa);
    expect(apiResult.gstPaisa).toBe(directResult.gstPaisa);
  });
});

describe('Bills DELETE', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;
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

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/bills', billsRouter);

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
  });

  it('DELETE /bills/:id — not found returns 404', async () => {
    const res = await app.request('/bills/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /bills/:id — hard deletes a draft bill', async () => {
    await (db as any).insert(bills).values(minimalBill);
    const res = await app.request('/bills/bill-001', { method: 'DELETE' });
    expect(res.status).toBe(204);
    const getRes = await app.request('/bills/bill-001');
    expect(getRes.status).toBe(404);
  });

  it('DELETE /bills/:id — 422 when bill is not draft', async () => {
    await (db as any).insert(bills).values({ ...minimalBill, status: 'invoiced' });
    const res = await app.request('/bills/bill-001', { method: 'DELETE' });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });
});
