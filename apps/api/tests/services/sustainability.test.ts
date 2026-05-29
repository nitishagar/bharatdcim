import { describe, it, expect, beforeEach } from 'vitest';
import { computeScope2, aggregateSourceKWh, activeRecOffsetKWh } from '../../src/services/sustainability.js';
import { createTestDb } from '../helpers.js';
import { tenants, meters, powerReadings, recCertificates } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-01-01T00:00:00Z';

// ─── computeScope2 (pure) ──────────────────────────────────────

describe('computeScope2 — pure function', () => {
  it('basic: 100 000 kWh @ 710 g/kWh → 71 000 kg gross, 71 000 net (no offset)', () => {
    const result = computeScope2({ nonRenewableKWh: 100_000, gridEmissionFactorGPerKwh: 710, recOffsetKWh: 0 });
    expect(result.scope2GrossKg).toBe(71_000);
    expect(result.scope2NetKg).toBe(71_000);
    expect(result.recOffsetKWh).toBe(0);
  });

  it('with partial offset: 40 000 kWh offset → net = round(60 000 × 710 / 1000) = 42 600 kg', () => {
    const result = computeScope2({ nonRenewableKWh: 100_000, gridEmissionFactorGPerKwh: 710, recOffsetKWh: 40_000 });
    expect(result.scope2GrossKg).toBe(71_000);
    expect(result.scope2NetKg).toBe(42_600);
    expect(result.recOffsetKWh).toBe(40_000);
  });

  it('offset is capped at nonRenewableKWh: offset 200 000 vs nonRenewable 100 000 → net = 0', () => {
    const result = computeScope2({ nonRenewableKWh: 100_000, gridEmissionFactorGPerKwh: 710, recOffsetKWh: 200_000 });
    expect(result.scope2NetKg).toBe(0);
    expect(result.recOffsetKWh).toBe(100_000);
    expect(result.scope2GrossKg).toBe(71_000);
  });

  it('zero nonRenewableKWh → both gross and net are 0', () => {
    const result = computeScope2({ nonRenewableKWh: 0, gridEmissionFactorGPerKwh: 710, recOffsetKWh: 0 });
    expect(result.scope2GrossKg).toBe(0);
    expect(result.scope2NetKg).toBe(0);
  });

  it('rounding: 999 kWh @ 710 → round(999×710/1000) = round(709.29) = 709 kg', () => {
    const result = computeScope2({ nonRenewableKWh: 999, gridEmissionFactorGPerKwh: 710, recOffsetKWh: 0 });
    expect(result.scope2GrossKg).toBe(709);
  });

  it('renewable kWh never increases emissions — pure non-renewable input used', () => {
    // If caller passes nonRenewableKWh = 0 (all renewable), result should be zero
    const result = computeScope2({ nonRenewableKWh: 0, gridEmissionFactorGPerKwh: 710, recOffsetKWh: 0 });
    expect(result.scope2GrossKg).toBe(0);
    expect(result.scope2NetKg).toBe(0);
  });
});

// ─── aggregateSourceKWh ────────────────────────────────────────

describe('aggregateSourceKWh', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'T1', stateCode: 'MH', createdAt: now, updatedAt: now });
    await (db as any).insert(meters).values({ id: 'meter-1', tenantId: 'tenant-1', name: 'M1', stateCode: 'MH', createdAt: now, updatedAt: now });
  });

  it('grid source → all non-renewable', async () => {
    await (db as any).insert(powerReadings).values({
      id: 'r1', meterId: 'meter-1', timestamp: '2026-03-01T00:00:00Z', kWh: 100_000, source: 'grid', createdAt: now,
    });
    const result = await aggregateSourceKWh(db, 'tenant-1', '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z');
    expect(result.nonRenewableKWh).toBeCloseTo(100);
    expect(result.renewableKWh).toBeCloseTo(0);
    expect(result.totalKWh).toBeCloseTo(100);
  });

  it('solar source → all renewable', async () => {
    await (db as any).insert(powerReadings).values({
      id: 'r1', meterId: 'meter-1', timestamp: '2026-03-15T00:00:00Z', kWh: 50_000, source: 'solar', createdAt: now,
    });
    const result = await aggregateSourceKWh(db, 'tenant-1', '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z');
    expect(result.renewableKWh).toBeCloseTo(50);
    expect(result.nonRenewableKWh).toBeCloseTo(0);
  });

  it('mixed sources: grid + solar', async () => {
    await (db as any).insert(powerReadings).values([
      { id: 'r1', meterId: 'meter-1', timestamp: '2026-03-01T00:00:00Z', kWh: 200_000, source: 'grid', createdAt: now },
      { id: 'r2', meterId: 'meter-1', timestamp: '2026-03-15T00:00:00Z', kWh: 80_000, source: 'solar', createdAt: now },
    ]);
    const result = await aggregateSourceKWh(db, 'tenant-1', '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z');
    expect(result.nonRenewableKWh).toBeCloseTo(200);
    expect(result.renewableKWh).toBeCloseTo(80);
    expect(result.totalKWh).toBeCloseTo(280);
  });

  it('null source → treated as non-renewable', async () => {
    await (db as any).insert(powerReadings).values({
      id: 'r1', meterId: 'meter-1', timestamp: '2026-03-05T00:00:00Z', kWh: 30_000, source: null, createdAt: now,
    });
    const result = await aggregateSourceKWh(db, 'tenant-1', '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z');
    expect(result.nonRenewableKWh).toBeCloseTo(30);
    expect(result.renewableKWh).toBeCloseTo(0);
  });

  it('empty result when no readings', async () => {
    const result = await aggregateSourceKWh(db, 'tenant-1', '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z');
    expect(result.totalKWh).toBe(0);
    expect(result.nonRenewableKWh).toBe(0);
  });

  it('tenant scoping — readings from another tenant are excluded', async () => {
    await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'T2', stateCode: 'KA', createdAt: now, updatedAt: now });
    await (db as any).insert(meters).values({ id: 'meter-2', tenantId: 'tenant-2', name: 'M2', stateCode: 'KA', createdAt: now, updatedAt: now });
    await (db as any).insert(powerReadings).values({
      id: 'r1', meterId: 'meter-2', timestamp: '2026-03-01T00:00:00Z', kWh: 500_000, source: 'grid', createdAt: now,
    });
    const result = await aggregateSourceKWh(db, 'tenant-1', '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z');
    expect(result.totalKWh).toBe(0);
  });
});

// ─── activeRecOffsetKWh ────────────────────────────────────────

describe('activeRecOffsetKWh', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'T1', stateCode: 'MH', createdAt: now, updatedAt: now });
  });

  it('returns 0 when no active RECs', async () => {
    const result = await activeRecOffsetKWh(db, 'tenant-1', '2026-03-01', '2026-03-31');
    expect(result).toBe(0);
  });

  it('sums active RECs overlapping the period', async () => {
    // 2 active RECs, each 1 MWh (1000 milliunits) = 1000 kWh each
    await (db as any).insert(recCertificates).values([
      { id: 'rec-1', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar', mwh: 1000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'active', createdAt: now, updatedAt: now },
      { id: 'rec-2', tenantId: 'tenant-1', certificateType: 'I-REC', serialNumber: 'SN002', source: 'wind', mwh: 2000, vintagePeriodStart: '2026-02-01', vintagePeriodEnd: '2026-04-30', status: 'active', createdAt: now, updatedAt: now },
    ]);
    const result = await activeRecOffsetKWh(db, 'tenant-1', '2026-03-01', '2026-03-31');
    expect(result).toBe(3000); // 1000 + 2000 kWh
  });

  it('excludes retired RECs', async () => {
    await (db as any).insert(recCertificates).values({
      id: 'rec-1', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar', mwh: 5000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'retired', createdAt: now, updatedAt: now,
    });
    const result = await activeRecOffsetKWh(db, 'tenant-1', '2026-03-01', '2026-03-31');
    expect(result).toBe(0);
  });

  it('excludes RECs outside the period', async () => {
    await (db as any).insert(recCertificates).values({
      id: 'rec-1', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar', mwh: 5000, vintagePeriodStart: '2026-05-01', vintagePeriodEnd: '2026-05-31', status: 'active', createdAt: now, updatedAt: now,
    });
    const result = await activeRecOffsetKWh(db, 'tenant-1', '2026-03-01', '2026-03-31');
    expect(result).toBe(0);
  });

  it('tenant scoping — excludes other tenants RECs', async () => {
    await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'T2', stateCode: 'KA', createdAt: now, updatedAt: now });
    await (db as any).insert(recCertificates).values({
      id: 'rec-1', tenantId: 'tenant-2', certificateType: 'REC', serialNumber: 'SN001', source: 'solar', mwh: 9000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'active', createdAt: now, updatedAt: now,
    });
    const result = await activeRecOffsetKWh(db, 'tenant-1', '2026-03-01', '2026-03-31');
    expect(result).toBe(0);
  });
});
