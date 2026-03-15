/**
 * Schema validation tests — verify zod validators reject invalid input with
 * structured 400 responses containing error.issues array.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { tariffs as tariffsRouter } from '../../src/routes/tariffs.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { billsRouter } from '../../src/routes/bills.js';
import { readingsRouter } from '../../src/routes/readings.js';
import { agentsRouter } from '../../src/routes/agents.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-15T00:00:00Z';

async function makeApp(db: Database) {
  const app = createAppWithTenant(db, 'tenant-1', { orgRole: 'admin' });
  app.route('/meters', metersRouter);
  app.route('/tariffs', tariffsRouter);
  app.route('/invoices', invoicesRouter);
  app.route('/bills', billsRouter);
  app.route('/readings', readingsRouter);
  app.route('/agents', agentsRouter);
  return app;
}

describe('Schema Validation', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
  });

  describe('POST /meters', () => {
    it('rejects non-string id with 400 and issues array', async () => {
      const app = await makeApp(db);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 123, name: 'Test', stateCode: 'MH' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.error.issues)).toBe(true);
      expect(body.error.issues.some((i: { field: string }) => i.field === 'id')).toBe(true);
    });

    it('rejects empty name with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'x', name: '', stateCode: 'MH' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.issues.some((i: { field: string }) => i.field === 'name')).toBe(true);
    });

    it('rejects invalid meterType enum with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'x', name: 'Test', stateCode: 'MH', meterType: 'wind' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.issues.some((i: { field: string }) => i.field === 'meterType')).toBe(true);
    });
  });

  describe('POST /tariffs', () => {
    it('rejects string baseEnergyRatePaisa with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'x', stateCode: 'MH', baseEnergyRatePaisa: 'abc' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.issues.some((i: { field: string }) => i.field === 'baseEnergyRatePaisa')).toBe(true);
    });

    it('rejects negative baseEnergyRatePaisa with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/tariffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'x', stateCode: 'MH', baseEnergyRatePaisa: -5 }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /invoices', () => {
    it('rejects invalid GSTIN format with 400 and field-level issues', async () => {
      const app = await makeApp(db);
      const res = await app.request('/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId: 'b1', supplierGSTIN: 'invalid', recipientGSTIN: 'also-invalid' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.error.issues)).toBe(true);
      expect(body.error.issues.some((i: { field: string }) => i.field === 'supplierGSTIN')).toBe(true);
    });
  });

  describe('POST /invoices/credit-notes', () => {
    it('rejects string amountPaisa with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/invoices/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: 'x', amountPaisa: 'fifty', reason: 'test' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.issues.some((i: { field: string }) => i.field === 'amountPaisa')).toBe(true);
    });
  });

  describe('POST /readings', () => {
    it('rejects non-array readings with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readings: 'not-an-array' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /agents/heartbeat', () => {
    it('rejects empty body (no agent_id or agentId) with 400', async () => {
      const app = await makeApp(db);
      const res = await app.request('/agents/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.error.issues)).toBe(true);
    });
  });

  describe('error response structure', () => {
    it('all 400 responses include error.issues array with field and message', async () => {
      const app = await makeApp(db);
      const res = await app.request('/meters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // missing all required fields
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(typeof body.error.message).toBe('string');
      expect(Array.isArray(body.error.issues)).toBe(true);
      for (const issue of body.error.issues) {
        expect(typeof issue.field).toBe('string');
        expect(typeof issue.message).toBe('string');
      }
    });
  });
});
