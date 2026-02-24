import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb } from '../helpers.js';
import { metersRouter } from '../../src/routes/meters.js';
import { tenants } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

function createApp(db: Database) {
  const app = new Hono<{ Variables: { db: Database } }>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    await next();
  });
  app.route('/meters', metersRouter);
  return app;
}

describe('Meter Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createApp(db);

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
        tenantId: 'tenant-1',
        name: 'Grid Meter A',
        stateCode: 'MH',
        meterType: 'grid',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('meter-001');
    expect(body.name).toBe('Grid Meter A');
  });

  it('POST /meters — validation error', async () => {
    const res = await app.request('/meters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'meter-bad' }), // missing tenantId, name, stateCode
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
        tenantId: 'tenant-1',
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
});
