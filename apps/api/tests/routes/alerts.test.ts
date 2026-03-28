import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { alertsRouter } from '../../src/routes/alerts.js';
import { tenants, meters, alertRules, alertEvents } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Alerts Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/alerts', alertsRouter);

    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-001', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });
  });

  // ALT-API-01: POST /alerts/rules → 201, rule created
  it('ALT-API-01: POST /rules creates an alert rule', async () => {
    const res = await app.request('/alerts/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'rule-1',
        meterId: 'meter-001',
        metric: 'temperature',
        operator: 'gt',
        threshold: 300,
        severity: 'warning',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('rule-1');
    expect(body.metric).toBe('temperature');
    expect(body.threshold).toBe(300);
  });

  // ALT-API-02: POST /alerts/rules — non-admin → 403
  it('ALT-API-02: POST /rules non-admin → 403', async () => {
    const testDb = await createTestDb();
    const nonAdminDb = testDb.db as unknown as Database;
    const nonAdminApp = createAppWithTenant(nonAdminDb, 'tenant-1', { orgRole: 'member' });
    nonAdminApp.route('/alerts', alertsRouter);

    // Seed tenant for non-admin app
    const now = new Date().toISOString();
    await (nonAdminDb as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });

    const res = await nonAdminApp.request('/alerts/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'rule-1',
        metric: 'temperature',
        operator: 'gt',
        threshold: 300,
        severity: 'warning',
      }),
    });
    expect(res.status).toBe(403);
  });

  // ALT-API-03: GET /alerts/rules → paginated list, tenant-scoped
  it('ALT-API-03: GET /rules returns tenant-scoped rules', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values([
      { id: 'rule-1', tenantId: 'tenant-1', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now },
      { id: 'rule-2', tenantId: 'tenant-1', metric: 'humidity', operator: 'gt', threshold: 800, severity: 'critical', enabled: 1, createdAt: now, updatedAt: now },
    ]);

    const res = await app.request('/alerts/rules');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  // ALT-API-04: PATCH /alerts/rules/:id — update threshold → 200
  it('ALT-API-04: PATCH /rules/:id updates threshold', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });

    const res = await app.request('/alerts/rules/rule-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: 350 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.threshold).toBe(350);
  });

  // ALT-API-05: PATCH /alerts/rules/:id — wrong tenant → 403
  it('ALT-API-05: PATCH /rules/:id from wrong tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-2', name: 'Other DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    // Rule belonging to tenant-2
    await (db as any).insert(alertRules).values({
      id: 'rule-2', tenantId: 'tenant-2', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });

    // App is tenant-1, trying to modify tenant-2's rule
    const res = await app.request('/alerts/rules/rule-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: 350 }),
    });
    expect(res.status).toBe(403);
  });

  // ALT-API-06: DELETE /alerts/rules/:id → 204
  it('ALT-API-06: DELETE /rules/:id removes rule', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });

    const res = await app.request('/alerts/rules/rule-1', { method: 'DELETE' });
    expect(res.status).toBe(204);

    const rows = await (db as any).select().from(alertRules).all();
    expect(rows).toHaveLength(0);
  });

  // ALT-API-07: GET /alerts — returns only unresolved alert_events for tenant
  it('ALT-API-07: GET /alerts returns unresolved events', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alertEvents).values([
      { id: 'ae1', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 350, threshold: 300, severity: 'warning', triggeredAt: now, resolvedAt: null, createdAt: now },
      { id: 'ae2', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001', value: 360, threshold: 300, severity: 'warning', triggeredAt: now, resolvedAt: now, createdAt: now },
    ]);

    const res = await app.request('/alerts');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('ae1');
  });

  // ALT-API-08: GET /alerts — resolved events excluded
  it('ALT-API-08: resolved alerts excluded from default listing', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alertEvents).values({
      id: 'ae1', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001',
      value: 350, threshold: 300, severity: 'warning',
      triggeredAt: now, resolvedAt: now, createdAt: now,
    });

    const res = await app.request('/alerts');
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  // ALT-API-09: POST /alerts/:id/resolve — sets resolved_at
  it('ALT-API-09: POST /alerts/:id/resolve sets resolved_at', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alertEvents).values({
      id: 'ae1', tenantId: 'tenant-1', ruleId: 'rule-1', meterId: 'meter-001',
      value: 350, threshold: 300, severity: 'warning',
      triggeredAt: now, resolvedAt: null, createdAt: now,
    });

    const res = await app.request('/alerts/ae1/resolve', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resolvedAt).not.toBeNull();
  });

  // ALT-API-10: POST /alerts/:id/resolve — wrong tenant → 403
  it('ALT-API-10: POST /alerts/:id/resolve wrong tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-2', name: 'Other DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alertRules).values({
      id: 'rule-2', tenantId: 'tenant-2', metric: 'temperature', operator: 'gt', threshold: 300, severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-002', tenantId: 'tenant-2', name: 'Grid B', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });
    await (db as any).insert(alertEvents).values({
      id: 'ae2', tenantId: 'tenant-2', ruleId: 'rule-2', meterId: 'meter-002',
      value: 350, threshold: 300, severity: 'warning',
      triggeredAt: now, resolvedAt: null, createdAt: now,
    });

    // App is tenant-1 trying to resolve tenant-2's alert
    const res = await app.request('/alerts/ae2/resolve', { method: 'POST' });
    expect(res.status).toBe(403);
  });
});
