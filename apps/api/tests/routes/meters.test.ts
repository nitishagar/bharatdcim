import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { tenants, powerReadings } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Meter Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/meters', metersRouter);

    // Seed a tenant for FK constraints
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-1',
      name: 'Test DC',
      stateCode: 'MH',
      createdAt: now,
      updatedAt: now,
    });
  });

  it('GET /meters — empty list', async () => {
    const res = await app.request('/meters');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /meters — create meter', async () => {
    const res = await app.request('/meters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'meter-001',
        name: 'Grid Meter A',
        stateCode: 'MH',
        meterType: 'grid',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('meter-001');
    expect(body.name).toBe('Grid Meter A');
    expect(body.tenantId).toBe('tenant-1');
  });

  it('POST /meters — validation error', async () => {
    const res = await app.request('/meters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'meter-bad' }), // missing name, stateCode
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /meters/:id — found', async () => {
    await app.request('/meters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'meter-002',
        name: 'DG Meter B',
        stateCode: 'MH',
        meterType: 'dg',
      }),
    });

    const res = await app.request('/meters/meter-002');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('DG Meter B');
  });

  it('GET /meters/:id — not found', async () => {
    const res = await app.request('/meters/nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /meters/:id — not found returns 404', async () => {
    const res = await app.request('/meters/nonexistent', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /meters/:id — hard deletes meter with no readings', async () => {
    await app.request('/meters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'meter-del', name: 'Delete Me', stateCode: 'MH' }),
    });
    const res = await app.request('/meters/meter-del', { method: 'DELETE' });
    expect(res.status).toBe(204);
    const getRes = await app.request('/meters/meter-del');
    expect(getRes.status).toBe(404);
  });

  it('DELETE /meters/:id — soft deletes meter that has readings', async () => {
    await app.request('/meters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'meter-soft', name: 'Soft Delete Me', stateCode: 'MH' }),
    });
    const now = new Date().toISOString();
    await (db as any).insert(powerReadings).values({
      id: 'reading-001', meterId: 'meter-soft', timestamp: now, createdAt: now,
    });
    const res = await app.request('/meters/meter-soft', { method: 'DELETE' });
    expect(res.status).toBe(204);
    // Not in list
    const listRes = await app.request('/meters');
    const list = await listRes.json();
    expect(list.find((m: { id: string }) => m.id === 'meter-soft')).toBeUndefined();
    // GET by ID returns 404
    const getRes = await app.request('/meters/meter-soft');
    expect(getRes.status).toBe(404);
  });
});
