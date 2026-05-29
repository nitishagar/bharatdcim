import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import { selectTariffForPeriod } from '../../src/services/billing.js';
import { tenants, tariffConfigs, meters } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const BASE_SLOT = JSON.stringify([{
  name: 'Normal', startHour: 0, startMinute: 0, endHour: 0, endMinute: 0,
  type: 'normal', multiplierBps: 10000, adderPaisa: 0,
}]);

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({
    id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
  });
  // tariffId left null — inserted after tariffs in each test
  await (db as any).insert(meters).values({
    id: 'meter-1', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH',
    createdAt: now, updatedAt: now,
  });
}

async function insertTariff(
  db: Database,
  id: string,
  version: number,
  effectiveFrom: string,
  effectiveTo: string | null,
  lineageKey: string | null = null,
) {
  const now = new Date().toISOString();
  await (db as any).insert(tariffConfigs).values({
    id, stateCode: 'MH', discom: 'MSEDCL', category: 'HT-I',
    effectiveFrom, effectiveTo,
    billingUnit: 'kWh', baseEnergyRatePaisa: 600, wheelingChargePaisa: 0,
    demandChargePerKvaPaisa: 30000, demandRatchetPercent: 75, minimumDemandKva: 0,
    timeSlotsJson: BASE_SLOT, fuelAdjustmentPaisa: 10, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 900, pfThresholdBps: 9000, pfPenaltyRatePaisa: 25,
    gstRateBps: 1800, lineageKey, version, createdAt: now, updatedAt: now,
  });
}

describe('selectTariffForPeriod', () => {
  let db: Database;
  let client: any;

  beforeEach(async () => {
    ({ db, client } = await createTestDb());
    await seedBase(db);
  });

  it('selects v1 for a period within v1 window', async () => {
    await insertTariff(db, 'mh-v1', 1, '2024-01-01', '2025-01-01', 'mh-lineage');
    await insertTariff(db, 'mh-v2', 2, '2025-01-01', null, 'mh-lineage');
    const result = await selectTariffForPeriod(
      db,
      { tariffId: 'mh-v1', tenantId: 'tenant-1', stateCode: 'MH' },
      '2024-06-01',
    );
    expect(result.id).toBe('mh-v1');
    expect(result.version).toBe(1);
  });

  it('selects v2 for a period within v2 window', async () => {
    await insertTariff(db, 'mh-v1', 1, '2024-01-01', '2025-01-01', 'mh-lineage');
    await insertTariff(db, 'mh-v2', 2, '2025-01-01', null, 'mh-lineage');
    const result = await selectTariffForPeriod(
      db,
      { tariffId: 'mh-v1', tenantId: 'tenant-1', stateCode: 'MH' },
      '2025-06-01',
    );
    expect(result.id).toBe('mh-v2');
    expect(result.version).toBe(2);
  });

  it('inclusive lower bound: period exactly on effectiveFrom selects that version', async () => {
    await insertTariff(db, 'mh-v1', 1, '2024-01-01', '2025-01-01', 'mh-lineage');
    await insertTariff(db, 'mh-v2', 2, '2025-01-01', null, 'mh-lineage');
    const result = await selectTariffForPeriod(
      db,
      { tariffId: 'mh-v1', tenantId: 'tenant-1', stateCode: 'MH' },
      '2025-01-01',
    );
    // half-open [from, to): period on 2025-01-01 → v2 (since v1.effectiveTo = 2025-01-01 is exclusive)
    expect(result.id).toBe('mh-v2');
  });

  it('half-open upper bound: period on effectiveTo selects next version', async () => {
    await insertTariff(db, 'mh-v1', 1, '2024-01-01', '2025-01-01', 'mh-lineage');
    await insertTariff(db, 'mh-v2', 2, '2025-01-01', null, 'mh-lineage');
    // 2025-01-01 is exactly effectiveTo of v1 → should NOT match v1 (upper bound exclusive)
    const result = await selectTariffForPeriod(
      db,
      { tariffId: 'mh-v1', tenantId: 'tenant-1', stateCode: 'MH' },
      '2024-12-31',
    );
    expect(result.id).toBe('mh-v1');
  });

  it('falls back to bound tariff row when no lineageKey', async () => {
    await insertTariff(db, 'mh-v1', 1, '2024-01-01', null, null);
    const result = await selectTariffForPeriod(
      db,
      { tariffId: 'mh-v1', tenantId: 'tenant-1', stateCode: 'MH' },
      '2025-06-01',
    );
    expect(result.id).toBe('mh-v1');
  });

  it('throws when no version matches (period before earliest effectiveFrom)', async () => {
    await insertTariff(db, 'mh-v1', 1, '2024-01-01', null, 'mh-lineage');
    await expect(
      selectTariffForPeriod(
        db,
        { tariffId: 'mh-v1', tenantId: 'tenant-1', stateCode: 'MH' },
        '2023-06-01',
      ),
    ).rejects.toThrow(/No tariff version effective/);
  });

  it('throws when bound tariff row not found', async () => {
    await expect(
      selectTariffForPeriod(
        db,
        { tariffId: 'nonexistent-id', tenantId: 'tenant-1', stateCode: 'MH' },
        '2024-06-01',
      ),
    ).rejects.toThrow(/Tariff nonexistent-id not found/);
  });
});
