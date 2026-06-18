import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb, createAppWithTenant, createCollectingCtx } from '../helpers.js';
import { envReadingsRouter } from '../../src/routes/env-readings.js';
import { tenants, meters, alertRules, alertEvents, notificationConfigs } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Phase 2 — Env breach dispatch + dedup', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
    await (db as any).insert(meters).values({ id: 'meter-1', tenantId: 'tenant-1', name: 'Grid', stateCode: 'MH', createdAt: now, updatedAt: now });
    // Temperature alert rule: temp > 30°C (300 tenths)
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', meterId: 'meter-1',
      metric: 'temperature', operator: 'gt', threshold: 300,
      severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  async function seedEnvEmailConfig() {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({
      id: 'nc-env', tenantId: 'tenant-1', name: 'Env Email', type: 'email',
      destination: 'ops@example.com',
      eventsJson: JSON.stringify(['env_temperature_breach', 'env_humidity_breach']),
      status: 'active', createdAt: now, updatedAt: now,
    });
  }

  const testEnv = { RESEND_API_KEY: 'test-key' } as any;

  async function postBreachReading(ctx: { waitUntil(p: Promise<unknown>): void }) {
    const app = createAppWithTenant(db, 'tenant-1', { irpCtx: ctx });
    app.route('/env-readings', envReadingsRouter);
    return app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-1', timestamp: '2026-03-01T10:00:00Z', temp_c: 35.0 }, // 350 tenths > 300
      ]),
    }, testEnv);
  }

  it('breach reading with email config dispatches exactly one env_temperature_breach notification', async () => {
    await seedEnvEmailConfig();
    const { ctx, flushAll } = createCollectingCtx();

    const res = await postBreachReading(ctx);
    expect(res.status).toBe(201);

    await flushAll(); // wait for waitUntil promises

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(body.subject).toContain('env_temperature_breach');
  });

  it('second breach reading with unresolved event creates zero new events (dedup)', async () => {
    await seedEnvEmailConfig();
    const { ctx, flushAll } = createCollectingCtx();

    // First breaching reading
    await postBreachReading(ctx);
    await flushAll();

    vi.mocked(fetch).mockClear();

    // Second breaching reading — unresolved event exists → should be deduped
    const { ctx: ctx2, flushAll: flushAll2 } = createCollectingCtx();
    await postBreachReading(ctx2);
    await flushAll2();

    const events = await (db as any).select().from(alertEvents).all();
    expect(events).toHaveLength(1); // still only 1 event
    expect(vi.mocked(fetch)).not.toHaveBeenCalled(); // no new dispatch
  });

  it('no email config → alert event created but no fetch call', async () => {
    // No notification config seeded
    const { ctx, flushAll } = createCollectingCtx();

    await postBreachReading(ctx);
    await flushAll();

    const events = await (db as any).select().from(alertEvents).all();
    expect(events).toHaveLength(1); // event still created
    expect(vi.mocked(fetch)).not.toHaveBeenCalled(); // no notification
  });

  it('below-threshold reading creates no alert event', async () => {
    const { ctx, flushAll } = createCollectingCtx();
    const app = createAppWithTenant(db, 'tenant-1', { irpCtx: ctx });
    app.route('/env-readings', envReadingsRouter);

    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-1', timestamp: '2026-03-01T10:00:00Z', temp_c: 25.0 }, // 250 tenths < 300 → no breach
      ]),
    }, testEnv);
    await flushAll();

    const events = await (db as any).select().from(alertEvents).all();
    expect(events).toHaveLength(0);
  });
});
