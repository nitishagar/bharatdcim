import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { platformRouter } from '../../src/routes/platform.js';
import { tenants, meters, bills, invoices, tariffConfigs } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

async function seedMultipleTenants(db: Database) {
  await (db as any).insert(tenants).values([
    { id: 'tenant-mh', name: 'Mumbai DC', stateCode: 'MH', createdAt: now, updatedAt: now },
    { id: 'tenant-ka', name: 'Bangalore DC', stateCode: 'KA', createdAt: now, updatedAt: now },
  ]);
  await (db as any).insert(tariffConfigs).values({
    id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2025-01-01',
    billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
    demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75, minimumDemandKva: 50,
    timeSlotsJson: '[]', fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20,
    version: 1, createdAt: now, updatedAt: now,
  });
  await (db as any).insert(meters).values([
    { id: 'm1', tenantId: 'tenant-mh', name: 'Meter MH', stateCode: 'MH', tariffId: 'tc1', createdAt: now, updatedAt: now },
    { id: 'm2', tenantId: 'tenant-ka', name: 'Meter KA', stateCode: 'KA', tariffId: 'tc1', createdAt: now, updatedAt: now },
  ]);
}

describe('Platform Admin Routes', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedMultipleTenants(db);
  });

  it('GET /platform/tenants — returns all tenants for platform admin', async () => {
    const app = createAppWithTenant(db, 'tenant-mh', { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('GET /platform/tenants — returns 403 for non-admin', async () => {
    const app = createAppWithTenant(db, 'tenant-mh', { platformAdmin: false });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/tenants');
    expect(res.status).toBe(403);
  });

  it('GET /platform/overview — returns cross-tenant stats', async () => {
    const app = createAppWithTenant(db, 'tenant-mh', { platformAdmin: true });
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/overview');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenants.total).toBe(2);
    expect(body.meters.total).toBe(2);
  });

  it('GET /platform/overview — returns 403 for regular user', async () => {
    const app = createAppWithTenant(db, 'tenant-mh');
    app.route('/platform', platformRouter);
    const res = await app.request('/platform/overview');
    expect(res.status).toBe(403);
  });
});
