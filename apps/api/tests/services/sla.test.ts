import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import {
  computeUptimeCompliance,
  computePUECompliance,
  checkSLAConfig,
  runDailyChecks,
} from '../../src/services/sla.js';
import { tenants, meters, powerReadings, slaConfigs, slaViolations, capacityThresholds, alerts } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-facility', tenantId: 'tenant-1', name: 'Facility', stateCode: 'MH', meterType: 'grid', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-it', tenantId: 'tenant-1', name: 'IT Load', stateCode: 'MH', meterType: 'it_load', createdAt: now, updatedAt: now });
}

async function seedReadings(db: Database, meterId: string, count: number, periodStart: string) {
  const start = new Date(periodStart);
  for (let i = 0; i < count; i++) {
    const ts = new Date(start.getTime() + i * 15 * 60 * 1000).toISOString();
    await (db as any).insert(powerReadings).values({
      id: `r-${meterId}-${i}`, meterId, timestamp: ts, kWh: 1000, kW: 100,
      createdAt: new Date().toISOString(),
    });
  }
}

describe('computeUptimeCompliance', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  it('96 readings in 1 day with pollingIntervalMin=15 → 10000 bps (100%)', async () => {
    await seedReadings(db, 'meter-facility', 96, '2026-01-01T00:00:00.000Z');
    const bps = await computeUptimeCompliance(db, 'meter-facility', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 15);
    expect(bps).toBe(10000);
  });

  it('48 readings in 1 day with pollingIntervalMin=15 → 5000 bps (50%)', async () => {
    await seedReadings(db, 'meter-facility', 48, '2026-01-01T00:00:00.000Z');
    const bps = await computeUptimeCompliance(db, 'meter-facility', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 15);
    expect(bps).toBe(5000);
  });

  it('0 readings → 0 bps', async () => {
    const bps = await computeUptimeCompliance(db, 'meter-facility', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 15);
    expect(bps).toBe(0);
  });

  it('100 readings (more than expected 96) → capped at 10000 bps', async () => {
    await seedReadings(db, 'meter-facility', 100, '2026-01-01T00:00:00.000Z');
    const bps = await computeUptimeCompliance(db, 'meter-facility', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 15);
    expect(bps).toBe(10000);
  });
});

describe('computePUECompliance', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  it('facility=10000 kWh×1000, it=7000 kWh×1000 → PUE = 14285 bps', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(powerReadings).values({ id: 'r-f1', meterId: 'meter-facility', timestamp: '2026-01-01T12:00:00.000Z', kWh: 10000, kW: 1000, createdAt: now });
    await (db as any).insert(powerReadings).values({ id: 'r-i1', meterId: 'meter-it', timestamp: '2026-01-01T12:00:00.000Z', kWh: 7000, kW: 700, createdAt: now });
    const bps = await computePUECompliance(db, 'tenant-1', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(bps).toBe(14285);
  });

  it('facility=15000 kWh×1000, it=10000 kWh×1000 → PUE = 15000 bps', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(powerReadings).values({ id: 'r-f1', meterId: 'meter-facility', timestamp: '2026-01-01T12:00:00.000Z', kWh: 15000, kW: 1500, createdAt: now });
    await (db as any).insert(powerReadings).values({ id: 'r-i1', meterId: 'meter-it', timestamp: '2026-01-01T12:00:00.000Z', kWh: 10000, kW: 1000, createdAt: now });
    const bps = await computePUECompliance(db, 'tenant-1', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(bps).toBe(15000);
  });

  it('it_load kWh = 0 → returns null (division guard)', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(powerReadings).values({ id: 'r-f1', meterId: 'meter-facility', timestamp: '2026-01-01T12:00:00.000Z', kWh: 10000, kW: 1000, createdAt: now });
    await (db as any).insert(powerReadings).values({ id: 'r-i1', meterId: 'meter-it', timestamp: '2026-01-01T12:00:00.000Z', kWh: 0, kW: 0, createdAt: now });
    const bps = await computePUECompliance(db, 'tenant-1', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(bps).toBeNull();
  });

  it('no it_load meters → returns null', async () => {
    const now = new Date().toISOString();
    // Only seed a tenant+meter with no it_load
    await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'DC2', stateCode: 'KA', createdAt: now, updatedAt: now });
    await (db as any).insert(meters).values({ id: 'meter-grid-only', tenantId: 'tenant-2', name: 'Grid', stateCode: 'KA', meterType: 'grid', createdAt: now, updatedAt: now });
    const bps = await computePUECompliance(db, 'tenant-2', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(bps).toBeNull();
  });

  it('no facility meters → returns null', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({ id: 'tenant-3', name: 'DC3', stateCode: 'DL', createdAt: now, updatedAt: now });
    await (db as any).insert(meters).values({ id: 'meter-it-only', tenantId: 'tenant-3', name: 'IT', stateCode: 'DL', meterType: 'it_load', createdAt: now, updatedAt: now });
    const bps = await computePUECompliance(db, 'tenant-3', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z');
    expect(bps).toBeNull();
  });
});

describe('checkSLAConfig', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  const periodStart = '2026-01-01T00:00:00.000Z';
  const periodEnd = '2026-01-02T00:00:00.000Z';

  it('config below target by ~1% → creates sla_violations row with severity=warning', async () => {
    // 94 readings / 96 expected = 97.9% = 9791 bps, target = 9900, gap = 109 < 5% → warning
    await seedReadings(db, 'meter-facility', 94, periodStart);
    const now = new Date().toISOString();
    const config = { id: 'sla-1', tenantId: 'tenant-1', type: 'uptime', targetBps: 9900, meterId: 'meter-facility', measurementWindow: 'daily', name: 'Test', status: 'active', createdAt: now, updatedAt: now };
    await (db as any).insert(slaConfigs).values(config);

    await checkSLAConfig(db, config, periodStart, periodEnd);

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('warning');
    expect(violations[0].slaConfigId).toBe('sla-1');
  });

  it('config below target by ~8% → creates sla_violations row with severity=critical', async () => {
    // 88 readings / 96 expected = 91.67% = 9166 bps, target = 9900, gap = 734 > 5% → critical
    await seedReadings(db, 'meter-facility', 88, periodStart);
    const now = new Date().toISOString();
    const config = { id: 'sla-1', tenantId: 'tenant-1', type: 'uptime', targetBps: 9900, meterId: 'meter-facility', measurementWindow: 'daily', name: 'Test', status: 'active', createdAt: now, updatedAt: now };
    await (db as any).insert(slaConfigs).values(config);

    await checkSLAConfig(db, config, periodStart, periodEnd);

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('critical');
  });

  it('config above target → no violation created', async () => {
    // 96 readings → 10000 bps, target = 9500 → no violation
    await seedReadings(db, 'meter-facility', 96, periodStart);
    const now = new Date().toISOString();
    const config = { id: 'sla-1', tenantId: 'tenant-1', type: 'uptime', targetBps: 9500, meterId: 'meter-facility', measurementWindow: 'daily', name: 'Test', status: 'active', createdAt: now, updatedAt: now };
    await (db as any).insert(slaConfigs).values(config);

    await checkSLAConfig(db, config, periodStart, periodEnd);

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations).toHaveLength(0);
  });

  it('existing open violation for same config+period → NOT duplicated (idempotent)', async () => {
    await seedReadings(db, 'meter-facility', 88, periodStart);
    const now = new Date().toISOString();
    const config = { id: 'sla-1', tenantId: 'tenant-1', type: 'uptime', targetBps: 9900, meterId: 'meter-facility', measurementWindow: 'daily', name: 'Test', status: 'active', createdAt: now, updatedAt: now };
    await (db as any).insert(slaConfigs).values(config);

    await checkSLAConfig(db, config, periodStart, periodEnd);
    await checkSLAConfig(db, config, periodStart, periodEnd); // run again

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations).toHaveLength(1); // still only 1
  });
});

describe('runDailyChecks', () => {
  let db: Database;
  const mockEnv = { RESEND_API_KEY: 'test-key' } as any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  it('calls checkSLAConfig for each active sla_config → violations created', async () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    // Seed 2 active uptime configs, both below target (88 readings)
    await seedReadings(db, 'meter-facility', 88, periodStart);
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'daily', meterId: 'meter-facility', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(slaConfigs).values({ id: 'sla-2', tenantId: 'tenant-1', name: 'SLA 2', type: 'uptime', targetBps: 9900, measurementWindow: 'daily', meterId: 'meter-facility', status: 'active', createdAt: now, updatedAt: now });

    // Run with referenceDate = 2026-01-02 so "yesterday" = 2026-01-01
    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });

  it('skips paused configs → no violations', async () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    await seedReadings(db, 'meter-facility', 88, periodStart);
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-paused', tenantId: 'tenant-1', name: 'Paused SLA', type: 'uptime', targetBps: 9900, measurementWindow: 'daily', meterId: 'meter-facility', status: 'paused', createdAt: now, updatedAt: now });

    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations).toHaveLength(0);
  });

  it('active capacity threshold above readings → creates capacity alert', async () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    const now = new Date().toISOString();
    // Seed a reading with kWh=500000 (500 kWh real). Threshold criticalValue=200 (real kWh)
    await (db as any).insert(powerReadings).values({ id: 'r-big', meterId: 'meter-facility', timestamp: '2026-01-01T12:00:00.000Z', kWh: 500000, kW: 10000, createdAt: now });
    await (db as any).insert(capacityThresholds).values({ id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-facility', metric: 'kwh_daily', warningValue: 100, criticalValue: 200, windowDays: 30, status: 'active', createdAt: now, updatedAt: now });

    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));

    const alertRows = await (db as any).select().from(alerts).all();
    expect(alertRows.length).toBeGreaterThanOrEqual(1);
    expect(alertRows[0].type).toBe('capacity_critical');
  });
});
