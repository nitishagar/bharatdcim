import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { platformRouter } from '../../src/routes/platform.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

async function seedTenant(db: Database) {
  await (db as any).insert(tenants).values({
    id: 'tenant-mh',
    name: 'Mumbai DC',
    stateCode: 'MH',
    createdAt: now,
    updatedAt: now,
  });
}

describe('POST /platform/tenants', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
  });

  it('creates a tenant and returns 201 for platform admin', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delhi DC', stateCode: 'DL' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Delhi DC');
    expect(body.stateCode).toBe('DL');
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('creates a tenant with optional gstin and billingAddress', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hyderabad DC',
        stateCode: 'TG',
        gstin: '36AABCU9603R1ZX',
        billingAddress: '123 Hitech City, Hyderabad',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.gstin).toBe('36AABCU9603R1ZX');
    expect(body.billingAddress).toBe('123 Hitech City, Hyderabad');
  });

  it('returns 403 for non-platform-admin', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: false });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delhi DC', stateCode: 'DL' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateCode: 'DL' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/name/i);
  });

  it('returns 400 when stateCode is missing', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Delhi DC' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/stateCode/i);
  });

  it('persists tenant to database', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    await app.request('/platform/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Chennai DC', stateCode: 'TN' }),
    });

    // Verify via GET
    const listRes = await app.request('/platform/tenants');
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Chennai DC');
  });
});

describe('PATCH /platform/tenants/:id', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedTenant(db);
  });

  it('updates tenant name and returns 200', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants/tenant-mh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mumbai DC Updated' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Mumbai DC Updated');
    expect(body.id).toBe('tenant-mh');
  });

  it('updates optional fields gstin and billingAddress', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants/tenant-mh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gstin: '27AABCU9603R1ZX',
        billingAddress: 'BKC, Mumbai',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gstin).toBe('27AABCU9603R1ZX');
    expect(body.billingAddress).toBe('BKC, Mumbai');
    expect(body.name).toBe('Mumbai DC'); // unchanged
  });

  it('updates stateCode', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants/tenant-mh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateCode: 'GJ' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stateCode).toBe('GJ');
  });

  it('returns 403 for non-platform-admin', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: false });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants/tenant-mh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 when tenant does not exist', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toMatch(/not found/i);
  });

  it('persists updates to database', async () => {
    const app = createAppWithTenant(db, null, { platformAdmin: true });
    app.route('/platform', platformRouter);
    await app.request('/platform/tenants/tenant-mh', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mumbai DC v2', gstin: '27AABCU9603R1ZX' }),
    });

    const listRes = await app.request('/platform/tenants');
    const list = await listRes.json();
    const updated = list.find((t: { id: string }) => t.id === 'tenant-mh');
    expect(updated.name).toBe('Mumbai DC v2');
    expect(updated.gstin).toBe('27AABCU9603R1ZX');
  });
});
