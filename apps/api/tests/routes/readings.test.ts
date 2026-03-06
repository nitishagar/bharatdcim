import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { readingsRouter } from '../../src/routes/readings.js';
import { tenants, meters } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Readings Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/readings', readingsRouter);

    // Seed tenant + meter
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-001', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });
  });

  it('GET /readings — requires meter_id', async () => {
    const res = await app.request('/readings');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /readings — batch insert', async () => {
    const readings = [
      { id: 'r1', meterId: 'meter-001', timestamp: '2026-02-15T10:00:00Z', kWh: 100, source: 'grid' },
      { id: 'r2', meterId: 'meter-001', timestamp: '2026-02-15T11:00:00Z', kWh: 110, source: 'grid' },
      { id: 'r3', meterId: 'meter-001', timestamp: '2026-02-15T12:00:00Z', kWh: 105, source: 'grid' },
    ];

    const res = await app.request('/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inserted).toBe(3);
  });

  it('POST /readings — empty array error', async () => {
    const res = await app.request('/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readings: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /readings?meter_id= — query by meter', async () => {
    // Insert readings first
    await app.request('/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readings: [
          { id: 'r1', meterId: 'meter-001', timestamp: '2026-02-15T10:00:00Z', kWh: 100 },
          { id: 'r2', meterId: 'meter-001', timestamp: '2026-02-15T14:00:00Z', kWh: 110 },
        ],
      }),
    });

    const res = await app.request('/readings?meter_id=meter-001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('GET /readings?meter_id=&from=&to= — date range filter', async () => {
    await app.request('/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readings: [
          { id: 'r1', meterId: 'meter-001', timestamp: '2026-02-10T10:00:00Z', kWh: 100 },
          { id: 'r2', meterId: 'meter-001', timestamp: '2026-02-15T10:00:00Z', kWh: 110 },
          { id: 'r3', meterId: 'meter-001', timestamp: '2026-02-20T10:00:00Z', kWh: 120 },
        ],
      }),
    });

    const res = await app.request('/readings?meter_id=meter-001&from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('r2');
  });
});
