import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { platformRouter } from '../../src/routes/platform.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

async function seedTenant(db: Database) {
  await (db as any).insert(tenants).values({
    id: 'tenant-001',
    name: 'Test DC',
    stateCode: 'MH',
    createdAt: now,
    updatedAt: now,
  });
}

describe('Tenant address PATCH endpoint', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedTenant(db);
  });

  it('TENANT-01: PATCH /platform/tenants/:id with address fields returns 200 with all fields echoed back', async () => {
    const app = createAppWithTenant(db, 'tenant-001', { platformAdmin: true });
    app.route('/platform', platformRouter);

    const res = await app.request('/platform/tenants/tenant-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName: 'Test DC Pvt Ltd',
        address1: '123 Server Farm Road',
        city: 'Mumbai',
        pincode: '400001',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.legalName).toBe('Test DC Pvt Ltd');
    expect(body.address1).toBe('123 Server Farm Road');
    expect(body.city).toBe('Mumbai');
    expect(body.pincode).toBe('400001');
  });

  it('TENANT-02: GET /platform/tenants after PATCH returns new address fields', async () => {
    const app = createAppWithTenant(db, 'tenant-001', { platformAdmin: true });
    app.route('/platform', platformRouter);

    // First PATCH
    await app.request('/platform/tenants/tenant-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalName: 'Test DC Pvt Ltd',
        address1: '123 Server Farm Road',
        city: 'Mumbai',
        pincode: '400001',
      }),
    });

    // Then GET tenants
    const getRes = await app.request('/platform/tenants');
    expect(getRes.status).toBe(200);
    const tenantList = await getRes.json();
    const updated = tenantList.find((t: any) => t.id === 'tenant-001');
    expect(updated).toBeDefined();
    expect(updated.legalName).toBe('Test DC Pvt Ltd');
    expect(updated.address1).toBe('123 Server Farm Road');
    expect(updated.city).toBe('Mumbai');
    expect(updated.pincode).toBe('400001');
  });
});
