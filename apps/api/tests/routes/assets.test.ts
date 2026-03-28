import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { assetsRouter } from '../../src/routes/assets.js';
import { racksRouter } from '../../src/routes/racks.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

describe('Asset Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/racks', racksRouter);
    app.route('/assets', assetsRouter);
    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now });
    // Seed a rack for FK tests
    await app.request('/racks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rack-1', name: 'Row A Rack 01' }),
    });
  });

  it('GET /assets — empty list', async () => {
    const res = await app.request('/assets');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /assets — creates asset without rack_id', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'asset-001', name: 'Dell R750', assetType: 'server' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('asset-001');
    expect(body.tenantId).toBe('tenant-1');
    expect(body.rackUnitSize).toBe(1);
    expect(body.rackId).toBeNull();
  });

  it('POST /assets — creates asset with rack_id', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'asset-002', name: 'Switch', assetType: 'network', rackId: 'rack-1', rackUnitStart: 1, rackUnitSize: 1 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rackId).toBe('rack-1');
    expect(body.rackUnitStart).toBe(1);
  });

  it('POST /assets — validation error when name missing', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'asset-bad', assetType: 'server' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /assets — validation error when assetType invalid', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'asset-bad2', name: 'X', assetType: 'invalid-type' }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /assets — 403 for org:member', async () => {
    const memberApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
    memberApp.route('/assets', assetsRouter);
    const res = await memberApp.request('/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'asset-m', name: 'X', assetType: 'server' }),
    });
    expect(res.status).toBe(403);
  });

  it('GET /assets?rack_id=X — filters by rack', async () => {
    await app.request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'a1', name: 'Server 1', assetType: 'server', rackId: 'rack-1' }) });
    await app.request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'a2', name: 'Server 2', assetType: 'server' }) });
    const res = await app.request('/assets?rack_id=rack-1');
    const list = await res.json();
    expect(Array.isArray(list) ? list : list.data).toHaveLength(1);
  });

  it('GET /assets/:id — returns single asset', async () => {
    await app.request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'asset-get', name: 'Get Me', assetType: 'storage' }) });
    const res = await app.request('/assets/asset-get');
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe('Get Me');
  });

  it('GET /assets/:id — 404 for other tenant', async () => {
    await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'Other DC', stateCode: 'KA', createdAt: now, updatedAt: now });
    const other = createAppWithTenant(db, 'tenant-2');
    other.route('/assets', assetsRouter);
    await app.request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'asset-t1', name: 'T1 Asset', assetType: 'server' }) });
    expect((await other.request('/assets/asset-t1')).status).toBe(404);
  });

  it('PATCH /assets/:id — updates rack_unit_start', async () => {
    await app.request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'asset-patch', name: 'Server', assetType: 'server', rackId: 'rack-1' }) });
    const res = await app.request('/assets/asset-patch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rackUnitStart: 10 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).rackUnitStart).toBe(10);
  });

  it('DELETE /assets/:id — hard deletes asset', async () => {
    await app.request('/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'asset-del', name: 'Delete Me', assetType: 'server' }) });
    expect((await app.request('/assets/asset-del', { method: 'DELETE' })).status).toBe(204);
    expect((await app.request('/assets/asset-del')).status).toBe(404);
  });
});
