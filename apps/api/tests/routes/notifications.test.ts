import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { notificationsRouter } from '../../src/routes/notifications.js';
import { tenants, notificationConfigs } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedBase(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'DC1', stateCode: 'MH', createdAt: now, updatedAt: now });
  await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'DC2', stateCode: 'KA', createdAt: now, updatedAt: now });
}

describe('Notification Config Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/notifications', notificationsRouter);
    await seedBase(db);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /notifications with email type + valid email → 201', async () => {
    const res = await app.request('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alert Email',
        type: 'email',
        destination: 'ops@example.com',
        events: ['capacity_warning', 'capacity_critical'],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('email');
    expect(body.tenantId).toBe('tenant-1');
  });

  it('POST /notifications with webhook type + valid URL → 201', async () => {
    const res = await app.request('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Slack Webhook',
        type: 'webhook',
        destination: 'https://hooks.slack.com/services/test',
        events: ['sla_breach'],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('webhook');
  });

  it('POST /notifications with invalid email format → 400', async () => {
    const res = await app.request('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Email',
        type: 'email',
        destination: 'not-an-email',
        events: ['capacity_warning'],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /notifications with invalid URL format for webhook → 400', async () => {
    const res = await app.request('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Webhook',
        type: 'webhook',
        destination: 'not-a-url',
        events: ['capacity_warning'],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /notifications with events containing invalid event names → 400', async () => {
    const res = await app.request('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Events',
        type: 'email',
        destination: 'ops@example.com',
        events: ['invalid_event'],
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /notifications without admin role → 403', async () => {
    const nonAdminApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
    nonAdminApp.route('/notifications', notificationsRouter);
    const res = await nonAdminApp.request('/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email',
        type: 'email',
        destination: 'ops@example.com',
        events: ['capacity_warning'],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /notifications → returns only tenant notification configs', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-1', tenantId: 'tenant-1', name: 'NC 1', type: 'email', destination: 'ops@t1.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });
    await (db as any).insert(notificationConfigs).values({ id: 'nc-x', tenantId: 'tenant-2', name: 'NC X', type: 'email', destination: 'ops@t2.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/notifications');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('nc-1');
  });

  it('GET /notifications for T1 does NOT include T2 configs', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-x', tenantId: 'tenant-2', name: 'NC X', type: 'email', destination: 'ops@t2.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/notifications');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });

  it('PATCH /notifications/:id → updates name, destination, events, status', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-1', tenantId: 'tenant-1', name: 'NC 1', type: 'email', destination: 'ops@t1.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/notifications/nc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated', destination: 'new@t1.com', status: 'paused' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated');
    expect(body.status).toBe('paused');
  });

  it('PATCH /notifications/:id from different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-x', tenantId: 'tenant-2', name: 'NC X', type: 'email', destination: 'ops@t2.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/notifications/nc-x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hijack' }),
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /notifications/:id → 204', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-1', tenantId: 'tenant-1', name: 'NC 1', type: 'email', destination: 'ops@t1.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/notifications/nc-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('POST /notifications/:id/test with email config → calls Resend API (mock fetch)', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-1', tenantId: 'tenant-1', name: 'NC 1', type: 'email', destination: 'ops@t1.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const res = await app.request('/notifications/nc-1/test', { method: 'POST' }, { RESEND_API_KEY: 'test-key' });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('POST /notifications/:id/test with webhook config → calls mock webhook URL', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-w', tenantId: 'tenant-1', name: 'Webhook', type: 'webhook', destination: 'https://hooks.example.com/test', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const mockFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);

    const res = await app.request('/notifications/nc-w/test', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.example.com/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('POST /notifications/:id/test for config from different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(notificationConfigs).values({ id: 'nc-x', tenantId: 'tenant-2', name: 'NC X', type: 'email', destination: 'ops@t2.com', eventsJson: '["capacity_warning"]', status: 'active', createdAt: now, updatedAt: now });

    const res = await app.request('/notifications/nc-x/test', { method: 'POST' });
    expect(res.status).toBe(403);
  });
});
