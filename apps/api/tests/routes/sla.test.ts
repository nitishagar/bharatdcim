import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { slaRouter } from '../../src/routes/sla.js';
import { tenants, meters, slaConfigs, slaViolations } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
  await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'DC2', stateCode: 'KA', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-1', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH', createdAt: now, updatedAt: now });
  await (db as any).insert(meters).values({ id: 'meter-x', tenantId: 'tenant-2', name: 'Grid B', stateCode: 'KA', createdAt: now, updatedAt: now });
}

describe('SLA Config Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/sla', slaRouter);
    await seedBase(db);
  });

  it('POST /sla with valid uptime config → 201', async () => {
    const res = await app.request('/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Uptime SLA', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('uptime');
    expect(body.tenantId).toBe('tenant-1');
  });

  it('POST /sla without admin role → 403', async () => {
    const nonAdminApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
    nonAdminApp.route('/sla', slaRouter);
    const res = await nonAdminApp.request('/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Uptime SLA', type: 'uptime', targetBps: 9900 }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /sla with target_bps > 10000 for uptime → 400 VALIDATION_ERROR', async () => {
    const res = await app.request('/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SLA', type: 'uptime', targetBps: 10500 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /sla with type=pue and target_bps < 10000 → 400', async () => {
    const res = await app.request('/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'PUE SLA', type: 'pue', targetBps: 9000 }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /sla with meter_id from different tenant → 403', async () => {
    const res = await app.request('/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'SLA', type: 'uptime', targetBps: 9900, meterId: 'meter-x' }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /sla → returns only tenant SLA configs', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(slaConfigs).values({ id: 'sla-x', tenantId: 'tenant-2', name: 'SLA X', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('sla-1');
  });

  it('GET /sla/:id → 200 with currentCompliance field', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla/sla-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('sla-1');
    expect(body).toHaveProperty('currentCompliance');
  });

  it('GET /sla/:id from different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-x', tenantId: 'tenant-2', name: 'SLA X', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla/sla-x');
    expect(res.status).toBe(403);
  });

  it("GET /sla/:id that doesn't exist → 404", async () => {
    const res = await app.request('/sla/nonexistent');
    expect(res.status).toBe(404);
  });

  it('PATCH /sla/:id updates name, targetBps, status', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla/sla-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated SLA', targetBps: 9800, status: 'paused' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated SLA');
    expect(body.targetBps).toBe(9800);
    expect(body.status).toBe('paused');
  });

  it('PATCH /sla/:id from different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-x', tenantId: 'tenant-2', name: 'SLA X', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla/sla-x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hijack' }),
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /sla/:id → 204', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla/sla-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });
});

describe('SLA Violations Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/sla', slaRouter);
    await seedBase(db);
  });

  it('GET /sla/:id/violations → paginated violations for this config only', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(slaViolations).values({ id: 'v-1', slaConfigId: 'sla-1', tenantId: 'tenant-1', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-02T00:00:00.000Z', targetBps: 9900, actualBps: 9500, gapBps: 400, severity: 'warning', status: 'open', createdAt: now });

    const res = await app.request('/sla/sla-1/violations');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('v-1');
  });

  it("GET /sla/:id/violations for different tenant's config → 403", async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-x', tenantId: 'tenant-2', name: 'SLA X', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/sla/sla-x/violations');
    expect(res.status).toBe(403);
  });

  it('PATCH /sla/violations/:id → acknowledged_at set', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(slaViolations).values({ id: 'v-1', slaConfigId: 'sla-1', tenantId: 'tenant-1', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-02T00:00:00.000Z', targetBps: 9900, actualBps: 9500, gapBps: 400, severity: 'warning', status: 'open', createdAt: now });

    const res = await app.request('/sla/violations/v-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('acknowledged');
    expect(body.acknowledgedAt).toBeTruthy();
  });

  it('PATCH /sla/violations/:id body={status:resolved} → resolved_at set', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-1', tenantId: 'tenant-1', name: 'SLA 1', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(slaViolations).values({ id: 'v-1', slaConfigId: 'sla-1', tenantId: 'tenant-1', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-02T00:00:00.000Z', targetBps: 9900, actualBps: 9500, gapBps: 400, severity: 'warning', status: 'open', createdAt: now });

    const res = await app.request('/sla/violations/v-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('resolved');
    expect(body.resolvedAt).toBeTruthy();
  });

  it('PATCH /sla/violations/:id from different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(slaConfigs).values({ id: 'sla-x', tenantId: 'tenant-2', name: 'SLA X', type: 'uptime', targetBps: 9900, measurementWindow: 'monthly', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(slaViolations).values({ id: 'v-x', slaConfigId: 'sla-x', tenantId: 'tenant-2', periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-01-02T00:00:00.000Z', targetBps: 9900, actualBps: 9500, gapBps: 400, severity: 'warning', status: 'open', createdAt: now });

    const res = await app.request('/sla/violations/v-x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    });
    expect(res.status).toBe(403);
  });
});
