import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import { calculateAndStoreBill } from '../../src/services/billing.js';
import { tenants, tariffConfigs, meters, powerReadings, bills } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

// Karnataka kWh tariff fixture with OA config
const kaBaseSlots = [
  { name: 'Night', startHour: 22, startMinute: 0, endHour: 6, endMinute: 0, type: 'off-peak', multiplierBps: 10000, adderPaisa: 0 },
  { name: 'Day', startHour: 6, startMinute: 0, endHour: 22, endMinute: 0, type: 'normal', multiplierBps: 10000, adderPaisa: 0 },
];

async function seedOAScenario(db: Database) {
  const now = new Date().toISOString();

  await (db as any).insert(tenants).values({
    id: 'tenant-1', name: 'Test DC', stateCode: 'KA', createdAt: now, updatedAt: now,
  });

  // OA tariff — with openAccess config
  await (db as any).insert(tariffConfigs).values({
    id: 'tariff-oa',
    stateCode: 'KA', discom: 'BESCOM', category: 'HT',
    effectiveFrom: '2026-01-01', effectiveTo: null,
    billingUnit: 'kWh',
    baseEnergyRatePaisa: 700,
    wheelingChargePaisa: 0,
    demandChargePerKvaPaisa: 0,
    demandRatchetPercent: 100,
    minimumDemandKva: 0,
    timeSlotsJson: JSON.stringify(kaBaseSlots),
    fuelAdjustmentPaisa: 0,
    fuelAdjustmentType: 'absolute',
    electricityDutyBps: 0,
    pfThresholdBps: 9000,
    pfPenaltyRatePaisa: 0,
    gstRateBps: 1800,
    version: 1,
    oaCssRatePaisa: 150,
    oaAdditionalSurchargePaisa: 50,
    oaTransmissionLossBps: 1000,
    createdAt: now, updatedAt: now,
  });

  // Non-OA tariff — no openAccess config
  await (db as any).insert(tariffConfigs).values({
    id: 'tariff-no-oa',
    stateCode: 'KA', discom: 'BESCOM', category: 'HT',
    effectiveFrom: '2026-01-01', effectiveTo: null,
    billingUnit: 'kWh',
    baseEnergyRatePaisa: 700,
    wheelingChargePaisa: 0,
    demandChargePerKvaPaisa: 0,
    demandRatchetPercent: 100,
    minimumDemandKva: 0,
    timeSlotsJson: JSON.stringify(kaBaseSlots),
    fuelAdjustmentPaisa: 0,
    fuelAdjustmentType: 'absolute',
    electricityDutyBps: 0,
    pfThresholdBps: 9000,
    pfPenaltyRatePaisa: 0,
    gstRateBps: 1800,
    version: 1,
    createdAt: now, updatedAt: now,
  });

  // OA meter
  await (db as any).insert(meters).values({
    id: 'meter-oa', tenantId: 'tenant-1', name: 'OA Meter', stateCode: 'KA',
    tariffId: 'tariff-oa', createdAt: now, updatedAt: now,
  });

  // Non-OA meter
  await (db as any).insert(meters).values({
    id: 'meter-no-oa', tenantId: 'tenant-1', name: 'Grid Meter', stateCode: 'KA',
    tariffId: 'tariff-no-oa', createdAt: now, updatedAt: now,
  });

  // Readings for OA meter: 600 kWh grid + 400 kWh solar (at PPA rate ₹4/unit = 400 paisa)
  await (db as any).insert(powerReadings).values({
    id: 'r-grid-1', meterId: 'meter-oa', timestamp: '2026-03-15T08:00:00Z',
    kWh: 600000, // stored ×1000
    source: 'grid', createdAt: now,
  });
  await (db as any).insert(powerReadings).values({
    id: 'r-solar-1', meterId: 'meter-oa', timestamp: '2026-03-15T10:00:00Z',
    kWh: 400000, // 400 kWh ×1000
    ratePaisa: 400, // PPA rate: ₹4.00/unit
    source: 'solar', createdAt: now,
  });

  // Readings for non-OA meter: 1000 kWh grid only
  await (db as any).insert(powerReadings).values({
    id: 'r-nooa-1', meterId: 'meter-no-oa', timestamp: '2026-03-15T08:00:00Z',
    kWh: 1000000,
    source: 'grid', createdAt: now,
  });
}

const baseParams = {
  tenantId: 'tenant-1',
  periodStart: '2026-03-01T00:00:00Z',
  periodEnd: '2026-03-31T23:59:59Z',
  contractedDemandKVA: 0,
  recordedDemandKVA: 0,
  powerFactor: 1.0,
};

describe('API billing — Open Access', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedOAScenario(db);
  });

  it('OA-API-01: solar readings aggregate into correct OA kWh', async () => {
    const result = await calculateAndStoreBill({ ...baseParams, meterId: 'meter-oa' }, db);
    // OA energy: 400 kWh × 400 paisa = 160000 paisa
    expect(result.bill.ppaEnergyChargesPaisa).toBe(160000);
  });

  it('OA-API-02: OA tariff computes CSS on solar kWh = 400 × 150 = 60000', async () => {
    const result = await calculateAndStoreBill({ ...baseParams, meterId: 'meter-oa' }, db);
    expect(result.bill.crossSubsidySurchargePaisa).toBe(60000);
  });

  it('OA-API-03: OA tariff computes Additional Surcharge on solar kWh = 400 × 50 = 20000', async () => {
    const result = await calculateAndStoreBill({ ...baseParams, meterId: 'meter-oa' }, db);
    expect(result.bill.additionalSurchargePaisa).toBe(20000);
  });

  it('OA-API-04: Transmission loss = ppaEnergyChargesPaisa × 1000 bps / 10000 = 16000', async () => {
    const result = await calculateAndStoreBill({ ...baseParams, meterId: 'meter-oa' }, db);
    expect(result.bill.transmissionLossChargesPaisa).toBe(16000); // 10% of 160000
  });

  it('OA-API-05: OA bill row persists all four OA columns', async () => {
    await calculateAndStoreBill({ ...baseParams, meterId: 'meter-oa' }, db);
    const billRows = await (db as any).select().from(bills).all();
    expect(billRows).toHaveLength(1);
    const bill = billRows[0];
    expect(bill.ppaEnergyChargesPaisa).toBe(160000);
    expect(bill.crossSubsidySurchargePaisa).toBe(60000);
    expect(bill.additionalSurchargePaisa).toBe(20000);
    expect(bill.transmissionLossChargesPaisa).toBe(16000);
  });

  it('OA-API-06: non-OA meter stores zeros for all OA columns', async () => {
    await calculateAndStoreBill({ ...baseParams, meterId: 'meter-no-oa' }, db);
    const billRows = await (db as any).select().from(bills).all();
    expect(billRows).toHaveLength(1);
    const bill = billRows[0];
    expect(bill.ppaEnergyChargesPaisa).toBe(0);
    expect(bill.crossSubsidySurchargePaisa).toBe(0);
    expect(bill.additionalSurchargePaisa).toBe(0);
    expect(bill.transmissionLossChargesPaisa).toBe(0);
  });

  it('OA-API-07: non-OA meter bill unchanged — only grid charges', async () => {
    const result = await calculateAndStoreBill({ ...baseParams, meterId: 'meter-no-oa' }, db);
    // 1000 kWh at 700 paisa normal rate
    expect(result.bill.totalEnergyChargesPaisa).toBe(700000);
    expect(result.bill.ppaEnergyChargesPaisa).toBe(0);
    expect(result.bill.subtotalPaisa).toBe(result.bill.totalEnergyChargesPaisa);
  });
});
