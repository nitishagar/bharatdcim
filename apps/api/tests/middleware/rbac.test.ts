import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { billsRouter } from '../../src/routes/bills.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { uploadsRouter } from '../../src/routes/uploads.js';
import { tariffs } from '../../src/routes/tariffs.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

describe('RBAC Enforcement', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
  });

  describe('org:member (read-only)', () => {
    it('POST /meters returns 403 for member', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
      app.route('/meters', metersRouter);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'm1', name: 'Test', stateCode: 'MH' }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.message).toContain('Admin role required');
    });

    it('POST /bills returns 403 for member', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
      app.route('/bills', billsRouter);
      const res = await app.request('/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'b1', meterId: 'm1', tariffId: 't1' }),
      });
      expect(res.status).toBe(403);
    });

    it('POST /bills/calculate returns 200 for member (stateless, read-safe)', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
      app.route('/bills', billsRouter);
      const res = await app.request('/bills/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readings: [{ timestamp: '2026-01-01T10:00:00Z', kWh: 100, slotType: 'normal', ratePaisa: 800 }],
          tariff: {
            id: 't1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT',
            effectiveFrom: '2025-01-01', effectiveTo: null, billingUnit: 'kWh',
            baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
            demandChargePerKVAPaisa: 50000, demandRatchetPercent: 75, minimumDemandKVA: 50,
            timeSlots: [], fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
            electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20, version: 1,
          },
        }),
      });
      expect(res.status).toBe(200);
    });

    it('POST /invoices returns 403 for member', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
      app.route('/invoices', invoicesRouter);
      const res = await app.request('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId: 'b1', supplierGSTIN: 'X', recipientGSTIN: 'Y' }),
      });
      expect(res.status).toBe(403);
    });

    it('POST /tariffs returns 403 for member', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
      app.route('/tariffs', tariffs);
      const res = await app.request('/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 't1', stateCode: 'MH', baseEnergyRatePaisa: 800 }),
      });
      expect(res.status).toBe(403);
    });

    it('GET /meters returns 200 for member (read allowed)', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'member' });
      app.route('/meters', metersRouter);
      const res = await app.request('/meters');
      expect(res.status).toBe(200);
    });
  });

  describe('org:admin (full access)', () => {
    it('POST /meters returns 201 for admin', async () => {
      const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'admin' });
      app.route('/meters', metersRouter);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'm1', name: 'Test', stateCode: 'MH' }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('API_TOKEN (bypasses RBAC)', () => {
    it('POST /tariffs returns 201 for API_TOKEN', async () => {
      const app = createAppWithTenant(db, null, { authType: 'api_token', orgRole: null });
      app.route('/tariffs', tariffs);
      const res = await app.request('/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 't1', stateCode: 'MH', baseEnergyRatePaisa: 800 }),
      });
      expect(res.status).toBe(201);
    });
  });
});
