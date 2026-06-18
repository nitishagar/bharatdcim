import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import { runDailyChecks, checkThresholdsForMeter } from '../../src/services/sla.js';
import { tenants, meters, powerReadings, capacityThresholds, alerts, notificationConfigs } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-1', tenantId: 'tenant-1', name: 'Main', stateCode: 'MH', meterType: 'grid', createdAt: now, updatedAt: now });
}

async function seedEmailConfig(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(notificationConfigs).values({
    id: 'nc-1',
    tenantId: 'tenant-1',
    name: 'Ops Email',
    type: 'email',
    destination: 'ops@example.com',
    eventsJson: JSON.stringify(['capacity_warning', 'capacity_critical']),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

async function seedThresholdAndReading(db: Database) {
  const now = new Date().toISOString();
  // Reading with kWh=500000 (500 real kWh), well above warning=100 / critical=200
  await (db as any).insert(powerReadings).values({
    id: 'r-1',
    meterId: 'meter-1',
    timestamp: '2026-01-01T12:00:00.000Z',
    kWh: 500000,
    kW: 10000,
    createdAt: now,
  });
  await (db as any).insert(capacityThresholds).values({
    id: 'ct-1',
    tenantId: 'tenant-1',
    meterId: 'meter-1',
    metric: 'kwh_daily',
    warningValue: 100,
    criticalValue: 200,
    windowDays: 30,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
}

describe('Phase 1 — Notification idempotency', () => {
  let db: Database;
  const mockEnv = { RESEND_API_KEY: 'test-key' } as any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await seedBase(db);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  describe('checkThresholdsForMeter — capacity alert dedup', () => {
    it('inserts alert on first call when threshold breached', async () => {
      await seedThresholdAndReading(db);
      const threshold = { id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-1', metric: 'kwh_daily', warningValue: 100, criticalValue: 200, windowDays: 30 };
      await checkThresholdsForMeter(db, threshold);
      const alertRows = await (db as any).select().from(alerts).all();
      expect(alertRows).toHaveLength(1);
    });

    it('does NOT insert duplicate alert when active alert already exists for same meter+metric', async () => {
      await seedThresholdAndReading(db);
      const threshold = { id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-1', metric: 'kwh_daily', warningValue: 100, criticalValue: 200, windowDays: 30 };
      await checkThresholdsForMeter(db, threshold);
      await checkThresholdsForMeter(db, threshold); // second call
      const alertRows = await (db as any).select().from(alerts).all();
      expect(alertRows).toHaveLength(1); // still only 1
    });
  });

  describe('runDailyChecks — dispatch-once', () => {
    it('dispatches capacity alert exactly once across two consecutive runs', async () => {
      await seedEmailConfig(db);
      await seedThresholdAndReading(db);

      // First run — should dispatch + mark notified_at
      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
      expect(vi.mocked(fetch)).toHaveBeenCalledOnce();

      vi.mocked(fetch).mockClear();

      // Second run — alert already has notified_at, should NOT dispatch again
      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it('only one alert row exists after two runDailyChecks runs (dedup check)', async () => {
      await seedThresholdAndReading(db);

      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));

      const alertRows = await (db as any).select().from(alerts).all();
      expect(alertRows).toHaveLength(1);
    });

    it('marks notified_at on alert after first successful dispatch', async () => {
      await seedEmailConfig(db);
      await seedThresholdAndReading(db);

      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));

      const alertRows = await (db as any).select().from(alerts).all();
      expect(alertRows[0].notifiedAt).toBeTruthy();
    });

    it('second run with no new breaches makes zero fetch calls', async () => {
      await seedEmailConfig(db);
      // No threshold seeded → no alerts → no dispatches
      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
      await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });
  });
});
