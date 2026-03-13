import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { billsRouter } from '../../src/routes/bills.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { tariffs as tariffsRouter } from '../../src/routes/tariffs.js';
import { uploadsRouter } from '../../src/routes/uploads.js';
import { agentsRouter } from '../../src/routes/agents.js';
import { readingsRouter } from '../../src/routes/readings.js';
import {
  tenants,
  meters,
  tariffConfigs,
  bills,
  invoices,
  agentHeartbeats,
  uploadAudit,
  powerReadings,
} from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

async function seedBase(db: Database) {
  await (db as any).insert(tenants).values({
    id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
  });
  await (db as any).insert(tariffConfigs).values({
    id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT',
    effectiveFrom: '2025-01-01', billingUnit: 'kWh', baseEnergyRatePaisa: 800,
    wheelingChargePaisa: 50, demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75,
    minimumDemandKva: 50, timeSlotsJson: '[]', fuelAdjustmentPaisa: 50,
    fuelAdjustmentType: 'absolute', electricityDutyBps: 600, pfThresholdBps: 9000,
    pfPenaltyRatePaisa: 20, version: 1, createdAt: now, updatedAt: now,
  });
}

async function seedMeters(db: Database, count: number) {
  for (let i = 1; i <= count; i++) {
    await (db as any).insert(meters).values({
      id: `m${i}`,
      tenantId: 'tenant-1',
      name: i % 2 === 1 ? `Grid Meter ${i}` : `DG Meter ${i}`,
      stateCode: 'MH',
      tariffId: 'tc1',
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function seedBills(db: Database, count: number) {
  await seedMeters(db, 1); // bills need a meter
  for (let i = 1; i <= count; i++) {
    await (db as any).insert(bills).values({
      id: `b${i}`, tenantId: 'tenant-1', meterId: 'm1', tariffId: 'tc1',
      billingPeriodStart: `2026-0${i}-01`, billingPeriodEnd: `2026-0${i}-28`,
      peakKwh: 100, normalKwh: 200, offPeakKwh: 50, totalKwh: 350,
      contractedDemandKva: 100, recordedDemandKva: 90, billedDemandKva: 100,
      powerFactor: 9500, peakChargesPaisa: 8000, normalChargesPaisa: 16000,
      offPeakChargesPaisa: 3000, totalEnergyChargesPaisa: 27000,
      wheelingChargesPaisa: 17500, demandChargesPaisa: 500000,
      fuelAdjustmentPaisa: 17500, electricityDutyPaisa: 34140,
      pfPenaltyPaisa: 0, dgChargesPaisa: 0, subtotalPaisa: 596140,
      gstPaisa: 107305, totalBillPaisa: 703445, effectiveRatePaisaPerKwh: 2010,
      status: 'draft', createdAt: now, updatedAt: now,
    });
  }
}

// ────────────────────────────────────────────────────────────────────────────

describe('GET /meters — pagination', () => {
  let db: Database;
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
    await seedMeters(db, 5);
  });

  it('returns paginated shape when ?limit is provided', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/meters', metersRouter);
    const res = await app.request('/meters?limit=2');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it('returns second page correctly', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/meters', metersRouter);
    const res = await app.request('/meters?limit=2&offset=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.offset).toBe(2);
    expect(body.total).toBe(5);
  });

  it('returns raw array when no ?limit param (backward compat)', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/meters', metersRouter);
    const res = await app.request('/meters');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5);
  });

  it('clamps limit to 100', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/meters', metersRouter);
    const res = await app.request('/meters?limit=200');
    const body = await res.json();
    expect(body.limit).toBe(100);
    expect(body.total).toBe(5);
  });

  it('filters by search term on name', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/meters', metersRouter);
    // Odd-numbered meters are "Grid Meter N", even are "DG Meter N"
    const res = await app.request('/meters?limit=10&search=Grid');
    const body = await res.json();
    expect(body.total).toBe(3); // meters 1, 3, 5
    expect(body.data.every((m: any) => m.name.includes('Grid'))).toBe(true);
  });
});

describe('GET /bills — pagination', () => {
  let db: Database;
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
    await seedBills(db, 5);
  });

  it('returns paginated shape when ?limit is provided', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/bills', billsRouter);
    const res = await app.request('/bills?limit=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
  });

  it('returns raw array when no ?limit param', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/bills', billsRouter);
    const res = await app.request('/bills');
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5);
  });
});

describe('GET /tariffs — pagination', () => {
  let db: Database;
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
    // Add 4 more tariffs
    for (let i = 2; i <= 5; i++) {
      await (db as any).insert(tariffConfigs).values({
        id: `tc${i}`, stateCode: 'MH', discom: i <= 3 ? 'MSEDCL' : 'TPDDL', category: 'HT',
        effectiveFrom: '2025-01-01', billingUnit: 'kWh', baseEnergyRatePaisa: 800,
        wheelingChargePaisa: 50, demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75,
        minimumDemandKva: 50, timeSlotsJson: '[]', fuelAdjustmentPaisa: 50,
        fuelAdjustmentType: 'absolute', electricityDutyBps: 600, pfThresholdBps: 9000,
        pfPenaltyRatePaisa: 20, version: 1, createdAt: now, updatedAt: now,
      });
    }
  });

  it('returns paginated tariffs when ?limit provided (tenant user)', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/tariffs', tariffsRouter);
    const res = await app.request('/tariffs?limit=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(5);
  });

  it('returns raw array when no ?limit param', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/tariffs', tariffsRouter);
    const res = await app.request('/tariffs');
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('filters tariffs by discom search', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/tariffs', tariffsRouter);
    const res = await app.request('/tariffs?limit=10&search=TPDDL');
    const body = await res.json();
    expect(body.total).toBe(2); // tc4, tc5
  });
});

describe('GET /uploads — pagination', () => {
  let db: Database;
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
    for (let i = 1; i <= 4; i++) {
      await (db as any).insert(uploadAudit).values({
        id: `up${i}`, tenantId: 'tenant-1', fileName: `readings_${i}.csv`, fileSize: 1024,
        format: 'native', totalRows: 10, importedRows: 10, skippedRows: 0,
        processingTimeMs: 50, createdAt: now,
      });
    }
  });

  it('returns paginated uploads', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/uploads', uploadsRouter);
    const res = await app.request('/uploads?limit=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(4);
  });

  it('returns raw array when no ?limit', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/uploads', uploadsRouter);
    const res = await app.request('/uploads');
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

describe('GET /agents — pagination', () => {
  let db: Database;
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
    for (let i = 1; i <= 4; i++) {
      await (db as any).insert(agentHeartbeats).values({
        id: `ah${i}`, agentId: `agent-${i}`, deviceCount: 5, unsyncedCount: 0,
        tenantId: 'tenant-1', status: 'online', lastHeartbeatAt: now,
        createdAt: now, updatedAt: now,
      });
    }
  });

  it('returns paginated agents', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/agents', agentsRouter);
    const res = await app.request('/agents?limit=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(4);
  });

  it('returns raw array when no ?limit', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/agents', agentsRouter);
    const res = await app.request('/agents');
    expect(Array.isArray(await res.json())).toBe(true);
  });
});

describe('GET /readings — pagination', () => {
  let db: Database;
  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
    await (db as any).insert(meters).values({
      id: 'm1', tenantId: 'tenant-1', name: 'Meter 1', stateCode: 'MH',
      tariffId: 'tc1', createdAt: now, updatedAt: now,
    });
    for (let i = 1; i <= 5; i++) {
      await (db as any).insert(powerReadings).values({
        id: `r${i}`, meterId: 'm1', timestamp: `2026-03-0${i}T10:00:00Z`,
        kWh: 100 * i, slotType: 'normal', createdAt: now,
      });
    }
  });

  it('returns paginated readings when ?limit provided', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/readings', readingsRouter);
    const res = await app.request('/readings?meter_id=m1&limit=2');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.limit).toBe(2);
  });

  it('returns raw array when no ?limit param', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/readings', readingsRouter);
    const res = await app.request('/readings?meter_id=m1');
    expect(Array.isArray(await res.json())).toBe(true);
  });
});
