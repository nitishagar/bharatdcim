import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { capacityRouter } from '../../src/routes/capacity.js';
import { tenants, meters, powerReadings, capacityThresholds, alerts } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({
    id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now,
  });
  await (db as any).insert(tenants).values({
    id: 'tenant-2', name: 'DC2', stateCode: 'KA', createdAt: now, updatedAt: now,
  });
  await (db as any).insert(meters).values({
    id: 'meter-1', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH',
    createdAt: now, updatedAt: now,
  });
  await (db as any).insert(meters).values({
    id: 'meter-x', tenantId: 'tenant-2', name: 'Grid B', stateCode: 'KA',
    createdAt: now, updatedAt: now,
  });
}

describe('Capacity Threshold Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/capacity', capacityRouter);
    await seedBase(db);
  });

  it('POST /capacity/thresholds — creates threshold for admin', async () => {
    const res = await app.request('/capacity/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meterId: 'meter-1',
        metric: 'kwh_daily',
        warningValue: 800000,
        criticalValue: 1000000,
        windowDays: 30,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.metric).toBe('kwh_daily');
    expect(body.tenantId).toBe('tenant-1');
  });

  it('POST /capacity/thresholds — 403 for non-admin', async () => {
    const nonAdminApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
    nonAdminApp.route('/capacity', capacityRouter);
    const res = await nonAdminApp.request('/capacity/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meterId: 'meter-1', metric: 'kwh_daily',
        warningValue: 800000, criticalValue: 1000000,
      }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /capacity/thresholds — 400 when criticalValue < warningValue', async () => {
    const res = await app.request('/capacity/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meterId: 'meter-1', metric: 'kwh_daily',
        warningValue: 1000000, criticalValue: 500000,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /capacity/thresholds — 400 when metric missing', async () => {
    const res = await app.request('/capacity/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meterId: 'meter-1', warningValue: 100, criticalValue: 200 }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /capacity/thresholds — 403 when meter belongs to different tenant', async () => {
    const res = await app.request('/capacity/thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meterId: 'meter-x', metric: 'kwh_daily',
        warningValue: 800000, criticalValue: 1000000,
      }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /capacity/thresholds — returns only tenant thresholds', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(capacityThresholds).values({
      id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-1',
      metric: 'kwh_daily', warningValue: 800000, criticalValue: 1000000,
      windowDays: 30, status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/thresholds');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('ct-1');
  });

  it('GET /capacity/thresholds?meter_id=X — filters by meter', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(capacityThresholds).values({
      id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-1',
      metric: 'kwh_daily', warningValue: 800000, criticalValue: 1000000,
      windowDays: 30, status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/thresholds?meter_id=meter-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);

    const emptyRes = await app.request('/capacity/thresholds?meter_id=other-meter');
    expect(emptyRes.status).toBe(200);
    expect(await emptyRes.json()).toHaveLength(0);
  });

  it('PATCH /capacity/thresholds/:id — updates threshold', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(capacityThresholds).values({
      id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-1',
      metric: 'kwh_daily', warningValue: 800000, criticalValue: 1000000,
      windowDays: 30, status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/thresholds/ct-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warningValue: 900000 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warningValue).toBe(900000);
  });

  it('PATCH /capacity/thresholds/:id — 403 for different tenant', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(capacityThresholds).values({
      id: 'ct-x', tenantId: 'tenant-2', meterId: 'meter-x',
      metric: 'kwh_daily', warningValue: 800000, criticalValue: 1000000,
      windowDays: 30, status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/thresholds/ct-x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warningValue: 900000 }),
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /capacity/thresholds/:id — 204', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(capacityThresholds).values({
      id: 'ct-1', tenantId: 'tenant-1', meterId: 'meter-1',
      metric: 'kwh_daily', warningValue: 800000, criticalValue: 1000000,
      windowDays: 30, status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/thresholds/ct-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('DELETE /capacity/thresholds/:id — 403 for different tenant', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(capacityThresholds).values({
      id: 'ct-x', tenantId: 'tenant-2', meterId: 'meter-x',
      metric: 'kwh_daily', warningValue: 800000, criticalValue: 1000000,
      windowDays: 30, status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/thresholds/ct-x', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

describe('Capacity Forecast Route', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/capacity', capacityRouter);
    await seedBase(db);
  });

  it('GET /capacity/forecast — 400 without meter_id', async () => {
    const res = await app.request('/capacity/forecast');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /capacity/forecast — 403 for meter from different tenant', async () => {
    const res = await app.request('/capacity/forecast?meter_id=meter-x');
    expect(res.status).toBe(403);
  });

  it('GET /capacity/forecast — returns empty aggregates for meter with no readings', async () => {
    const res = await app.request('/capacity/forecast?meter_id=meter-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dailyAggregates).toEqual([]);
    expect(body.trendSlope).toBe(0);
    expect(body.r2).toBe(0);
    expect(body.projectedBreachAt).toBeNull();
  });

  it('GET /capacity/forecast — returns trend data for meter with readings', async () => {
    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      const ts = new Date(2026, 0, i + 1).toISOString();
      await (db as any).insert(powerReadings).values({
        id: `r-${i}`, meterId: 'meter-1', timestamp: ts,
        kWh: (100 + i * 10) * 1000, kW: 10000, createdAt: now,
      });
    }
    const res = await app.request('/capacity/forecast?meter_id=meter-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dailyAggregates.length).toBeGreaterThan(0);
    expect(body.trendSlope).toBeGreaterThan(0); // growing trend
    expect(body.thresholds).toBeInstanceOf(Array);
  });

  it('GET /capacity/forecast — 400 for window_days < 7', async () => {
    const res = await app.request('/capacity/forecast?meter_id=meter-1&window_days=3');
    expect(res.status).toBe(400);
  });

  it('GET /capacity/forecast — 400 for window_days > 365', async () => {
    const res = await app.request('/capacity/forecast?meter_id=meter-1&window_days=400');
    expect(res.status).toBe(400);
  });
});

describe('Capacity Alert Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/capacity', capacityRouter);
    await seedBase(db);
  });

  it('GET /capacity/alerts — returns only tenant capacity alerts', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alerts).values({
      id: 'a-1', tenantId: 'tenant-1', meterId: 'meter-1',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 850000,
      severity: 'warning', status: 'active', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alerts).values({
      id: 'a-2', tenantId: 'tenant-2', meterId: 'meter-x',
      type: 'capacity_critical', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 1100000,
      severity: 'critical', status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/alerts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('a-1');
  });

  it('GET /capacity/alerts?status=active — filters by status', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alerts).values({
      id: 'a-1', tenantId: 'tenant-1', meterId: 'meter-1',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 850000,
      severity: 'warning', status: 'active', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alerts).values({
      id: 'a-2', tenantId: 'tenant-1', meterId: 'meter-1',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 900000,
      severity: 'warning', status: 'acknowledged', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/alerts?status=active');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe('active');
  });

  it('PATCH /capacity/alerts/:id — acknowledges alert', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alerts).values({
      id: 'a-1', tenantId: 'tenant-1', meterId: 'meter-1',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 850000,
      severity: 'warning', status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/alerts/a-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('acknowledged');
    expect(body.acknowledgedAt).toBeTruthy();
  });

  it('PATCH /capacity/alerts/:id — resolves alert', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alerts).values({
      id: 'a-1', tenantId: 'tenant-1', meterId: 'meter-1',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 850000,
      severity: 'warning', status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/alerts/a-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('resolved');
    expect(body.resolvedAt).toBeTruthy();
  });

  it('PATCH /capacity/alerts/:id — 403 for different tenant alert', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alerts).values({
      id: 'a-x', tenantId: 'tenant-2', meterId: 'meter-x',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 850000,
      severity: 'warning', status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/alerts/a-x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    expect(res.status).toBe(403);
  });

  it('PATCH /capacity/alerts/:id — 400 for invalid status', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alerts).values({
      id: 'a-1', tenantId: 'tenant-1', meterId: 'meter-1',
      type: 'capacity_warning', metric: 'kwh_daily',
      thresholdValue: 1000000, currentValue: 850000,
      severity: 'warning', status: 'active', createdAt: now, updatedAt: now,
    });
    const res = await app.request('/capacity/alerts/a-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'deleted' }),
    });
    expect(res.status).toBe(400);
  });
});
