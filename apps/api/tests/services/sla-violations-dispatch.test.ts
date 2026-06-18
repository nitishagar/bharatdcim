import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '../helpers.js';
import { runDailyChecks } from '../../src/services/sla.js';
import {
  tenants, meters, powerReadings, slaConfigs, slaViolations, notificationConfigs,
} from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-facility', tenantId: 'tenant-1', name: 'Facility', stateCode: 'MH', meterType: 'grid', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-it', tenantId: 'tenant-1', name: 'IT Load', stateCode: 'MH', meterType: 'it_load', createdAt: now, updatedAt: now });
}

async function seedSlaEmailConfig(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(notificationConfigs).values({
    id: 'nc-sla', tenantId: 'tenant-1', name: 'SLA Email', type: 'email',
    destination: 'ops@example.com',
    eventsJson: JSON.stringify(['sla_warning', 'sla_breach']),
    status: 'active', createdAt: now, updatedAt: now,
  });
}

describe('Phase 2 — SLA violation dispatch', () => {
  let db: Database;
  const mockEnv = { RESEND_API_KEY: 'test-key' } as any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await seedBase(db);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('runDailyChecks dispatches sla_breach exactly once for a new violation', async () => {
    await seedSlaEmailConfig(db);
    const periodStart = '2026-01-01T00:00:00.000Z';
    const now = new Date().toISOString();

    // 88 readings / 96 expected = 91.67% → below 9900 target → critical violation
    const start = new Date(periodStart);
    for (let i = 0; i < 88; i++) {
      const ts = new Date(start.getTime() + i * 15 * 60 * 1000).toISOString();
      await (db as any).insert(powerReadings).values({ id: `r-${i}`, meterId: 'meter-facility', timestamp: ts, kWh: 1000, kW: 100, createdAt: now });
    }
    await (db as any).insert(slaConfigs).values({
      id: 'sla-1', tenantId: 'tenant-1', name: 'Uptime SLA', type: 'uptime',
      targetBps: 9900, measurementWindow: 'daily', meterId: 'meter-facility',
      status: 'active', createdAt: now, updatedAt: now,
    });

    // First run: should create violation + dispatch
    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();

    vi.mocked(fetch).mockClear();

    // Second run: violation already has notified_at → zero dispatches
    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('sla_violations.notified_at is set after first dispatch', async () => {
    await seedSlaEmailConfig(db);
    const periodStart = '2026-01-01T00:00:00.000Z';
    const now = new Date().toISOString();
    const start = new Date(periodStart);
    for (let i = 0; i < 88; i++) {
      const ts = new Date(start.getTime() + i * 15 * 60 * 1000).toISOString();
      await (db as any).insert(powerReadings).values({ id: `r-${i}`, meterId: 'meter-facility', timestamp: ts, kWh: 1000, kW: 100, createdAt: now });
    }
    await (db as any).insert(slaConfigs).values({
      id: 'sla-1', tenantId: 'tenant-1', name: 'Uptime SLA', type: 'uptime',
      targetBps: 9900, measurementWindow: 'daily', meterId: 'meter-facility',
      status: 'active', createdAt: now, updatedAt: now,
    });

    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));

    const violations = await (db as any).select().from(slaViolations).all();
    expect(violations).toHaveLength(1);
    expect(violations[0].notifiedAt).toBeTruthy();
  });

  it('dispatches sla_warning event for warning-severity violations', async () => {
    const periodStart = '2026-01-01T00:00:00.000Z';
    const now = new Date().toISOString();

    // 94 readings / 96 expected = ~97.9% bps = 9791. target=9900, gap=109. 5% of target = 495 → gap < 5% → warning
    const start = new Date(periodStart);
    for (let i = 0; i < 94; i++) {
      const ts = new Date(start.getTime() + i * 15 * 60 * 1000).toISOString();
      await (db as any).insert(powerReadings).values({ id: `r-${i}`, meterId: 'meter-facility', timestamp: ts, kWh: 1000, kW: 100, createdAt: now });
    }
    await (db as any).insert(slaConfigs).values({
      id: 'sla-1', tenantId: 'tenant-1', name: 'Uptime SLA', type: 'uptime',
      targetBps: 9900, measurementWindow: 'daily', meterId: 'meter-facility',
      status: 'active', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-sla', tenantId: 'tenant-1', name: 'SLA Warn', type: 'email',
      destination: 'ops@example.com',
      eventsJson: JSON.stringify(['sla_warning']),
      status: 'active', createdAt: now, updatedAt: now,
    });

    await runDailyChecks(db, mockEnv, new Date('2026-01-02T01:00:00.000Z'));
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(body.subject).toContain('sla_warning');
  });
});
