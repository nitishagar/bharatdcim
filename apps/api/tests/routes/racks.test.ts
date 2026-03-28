import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { racksRouter } from '../../src/routes/racks.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

describe('Rack Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/racks', racksRouter);
    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now });
  });

  it('GET /racks — empty list', async () => {
    const res = await app.request('/racks');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /racks — creates rack with default capacityU=42', async () => {
    const res = await app.request('/racks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rack-001', name: 'Row A Rack 01' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('rack-001');
    expect(body.tenantId).toBe('tenant-1');
    expect(body.capacityU).toBe(42);
    expect(body.status).toBe('active');
  });

  it('POST /racks — validation error when name missing', async () => {
    const res = await app.request('/racks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rack-bad' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /racks — returns 403 for org:member', async () => {
    const memberApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
    memberApp.route('/racks', racksRouter);
    const res = await memberApp.request('/racks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rack-002', name: 'Test Rack' }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /racks — paginated when ?limit provided', async () => {
    for (let i = 1; i <= 3; i++) {
      await app.request('/racks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: `rack-00${i}`, name: `Rack ${i}` }),
      });
    }
    const res = await app.request('/racks?limit=2&offset=0');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(3);
  });

  it('GET /racks?search=Row — filters by name', async () => {
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'r1', name: 'Row A Rack 01' }) });
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'r2', name: 'Cooling Rack' }) });
    const res = await app.request('/racks?limit=25&search=Row');
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Row A Rack 01');
  });

  it('GET /racks/:id — returns single rack', async () => {
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rack-get', name: 'Get Me' }) });
    const res = await app.request('/racks/rack-get');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Get Me');
  });

  it('GET /racks/:id — 404 for other tenant', async () => {
    const otherApp = createAppWithTenant(db, 'tenant-2');
    otherApp.route('/racks', racksRouter);
    // Create rack for tenant-1
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rack-t1', name: 'T1 Rack' }) });
    // tenant-2 cannot see tenant-1's rack
    const res = await otherApp.request('/racks/rack-t1');
    expect(res.status).toBe(404);
  });

  it('PATCH /racks/:id — updates name and location', async () => {
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rack-patch', name: 'Old Name' }) });
    const res = await app.request('/racks/rack-patch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name', location: 'Row B' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('New Name');
    expect(body.location).toBe('Row B');
  });

  it('DELETE /racks/:id — hard deletes rack with no assets', async () => {
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rack-del', name: 'Delete Me' }) });
    const res = await app.request('/racks/rack-del', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect((await app.request('/racks/rack-del')).status).toBe(404);
  });

  it('GET /racks — does not return deleted racks', async () => {
    await app.request('/racks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rack-gone', name: 'Gone' }) });
    await app.request('/racks/rack-gone', { method: 'DELETE' });
    const res = await app.request('/racks');
    expect((await res.json())).toEqual([]);
  });
});
