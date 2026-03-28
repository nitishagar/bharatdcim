import { describe, it, expect } from 'vitest';
import { createTestDb } from '../helpers.js';
import { sites, racks, assets, billDisputes, meters, tenants, bills, tariffConfigs } from '../../src/db/schema.js';

describe('Asset Management Schema', () => {
  it('createTestDb creates sites, racks, assets, bill_disputes tables', async () => {
    const { client } = await createTestDb();
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = result.rows.map((r) => r.name as string);
    expect(tableNames).toContain('sites');
    expect(tableNames).toContain('racks');
    expect(tableNames).toContain('assets');
    expect(tableNames).toContain('bill_disputes');
  });

  it('meters table has rack_id column', async () => {
    const { client } = await createTestDb();
    const result = await client.execute("PRAGMA table_info(meters)");
    const colNames = result.rows.map((r) => r.name as string);
    expect(colNames).toContain('rack_id');
  });

  it('Drizzle schema exports sites, racks, assets, billDisputes', () => {
    expect(sites.id).toBeDefined();
    expect(sites.tenantId).toBeDefined();
    expect(sites.name).toBeDefined();
    expect(racks.id).toBeDefined();
    expect(racks.tenantId).toBeDefined();
    expect(racks.capacityU).toBeDefined();
    expect(assets.id).toBeDefined();
    expect(assets.rackId).toBeDefined();
    expect(assets.assetType).toBeDefined();
    expect(assets.rackUnitStart).toBeDefined();
    expect(assets.rackUnitSize).toBeDefined();
    expect(billDisputes.id).toBeDefined();
    expect(billDisputes.billId).toBeDefined();
    expect(billDisputes.disputedBy).toBeDefined();
    expect(meters.rackId).toBeDefined();
  });

  it('CRUD works on sites → racks → assets hierarchy', async () => {
    const { db } = await createTestDb();
    const now = new Date().toISOString();

    await (db as any).insert(tenants).values({ id: 't1', name: 'TestCo', stateCode: 'MH', createdAt: now, updatedAt: now });

    await (db as any).insert(sites).values({ id: 'site-1', tenantId: 't1', name: 'Mumbai DC', stateCode: 'MH', createdAt: now, updatedAt: now });
    const siteRows = await (db as any).select().from(sites).all();
    expect(siteRows).toHaveLength(1);
    expect(siteRows[0].name).toBe('Mumbai DC');

    await (db as any).insert(racks).values({ id: 'rack-1', tenantId: 't1', siteId: 'site-1', name: 'Row A Rack 01', capacityU: 42, createdAt: now, updatedAt: now });
    const rackRows = await (db as any).select().from(racks).all();
    expect(rackRows).toHaveLength(1);
    expect(rackRows[0].capacityU).toBe(42);

    await (db as any).insert(assets).values({ id: 'asset-1', tenantId: 't1', rackId: 'rack-1', name: 'Dell R750', assetType: 'server', rackUnitStart: 1, rackUnitSize: 2, createdAt: now, updatedAt: now });
    const assetRows = await (db as any).select().from(assets).all();
    expect(assetRows).toHaveLength(1);
    expect(assetRows[0].assetType).toBe('server');
  });

  it('CRUD works on bill_disputes', async () => {
    const { db } = await createTestDb();
    const now = new Date().toISOString();

    await (db as any).insert(tenants).values({ id: 't1', name: 'TestCo', stateCode: 'MH', createdAt: now, updatedAt: now });
    await (db as any).insert(tariffConfigs).values({
      id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: now,
      billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 0,
      demandChargePerKvaPaisa: 0, demandRatchetPercent: 100, minimumDemandKva: 0,
      timeSlotsJson: '[]', fuelAdjustmentPaisa: 0, fuelAdjustmentType: 'absolute',
      electricityDutyBps: 0, pfThresholdBps: 9000, pfPenaltyRatePaisa: 0, version: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({ id: 'm1', tenantId: 't1', name: 'Grid A', stateCode: 'MH', tariffId: 'tc1', createdAt: now, updatedAt: now });
    await (db as any).insert(bills).values({
      id: 'bill-1', tenantId: 't1', meterId: 'm1', tariffId: 'tc1',
      billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
      peakKwh: 0, normalKwh: 1000, offPeakKwh: 0, totalKwh: 1000,
      contractedDemandKva: 100, recordedDemandKva: 80, billedDemandKva: 100,
      powerFactor: 9500, peakChargesPaisa: 0, normalChargesPaisa: 80000, offPeakChargesPaisa: 0,
      totalEnergyChargesPaisa: 80000, wheelingChargesPaisa: 0, demandChargesPaisa: 0,
      fuelAdjustmentPaisa: 0, electricityDutyPaisa: 0, pfPenaltyPaisa: 0, dgChargesPaisa: 0,
      subtotalPaisa: 80000, gstPaisa: 14400, totalBillPaisa: 94400, effectiveRatePaisaPerKwh: 800,
      createdAt: now, updatedAt: now,
    });

    await (db as any).insert(billDisputes).values({ id: 'disp-1', billId: 'bill-1', tenantId: 't1', disputedBy: 'user_abc', reason: 'Incorrect meter reading', createdAt: now, updatedAt: now });
    const disputes = await (db as any).select().from(billDisputes).all();
    expect(disputes).toHaveLength(1);
    expect(disputes[0].status).toBe('open');
    expect(disputes[0].reason).toBe('Incorrect meter reading');
  });
});
