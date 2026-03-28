import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { envReadingsRouter } from '../../src/routes/env-readings.js';
import { tenants, meters, alertRules, alertEvents, envReadings } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('Env Readings Routes', () => {
  let db: Database;
  let app: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    app = createAppWithTenant(db, 'tenant-1');
    app.route('/env-readings', envReadingsRouter);

    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-001', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });
  });

  // ENV-API-01: POST /env-readings/batch with valid data → 201, {inserted: N}
  it('ENV-API-01: POST /batch valid data returns 201', async () => {
    const res = await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 23.5, humidity: 45.0 },
        { meter_id: 'meter-001', timestamp: '2026-03-01T11:00:00Z', temp_c: 24.0, humidity: 46.0 },
      ]),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inserted).toBe(2);
  });

  // ENV-API-02: temp_c scaled × 10 on insert (23.5 → 235)
  it('ENV-API-02: temp_c is scaled ×10 on insert', async () => {
    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 23.5, humidity: 45.0 },
      ]),
    });

    const rows = await (db as any).select().from(envReadings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].tempCTenths).toBe(235);
  });

  // ENV-API-03: humidity scaled × 10 on insert (45.0 → 450)
  it('ENV-API-03: humidity is scaled ×10 on insert', async () => {
    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 23.5, humidity: 45.0 },
      ]),
    });

    const rows = await (db as any).select().from(envReadings).all();
    expect(rows[0].humidityPctTenths).toBe(450);
  });

  // ENV-API-04: meter not belonging to tenant → 403
  it('ENV-API-04: meter belonging to different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-2', name: 'Other DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-002', tenantId: 'tenant-2', name: 'Grid B', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });

    const res = await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-002', timestamp: '2026-03-01T10:00:00Z', temp_c: 23.5 },
      ]),
    });
    expect(res.status).toBe(403);
  });

  // ENV-API-05: non-existent meter_id → 400
  it('ENV-API-05: non-existent meter_id → 400', async () => {
    const res = await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-nonexistent', timestamp: '2026-03-01T10:00:00Z', temp_c: 23.5 },
      ]),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // ENV-API-06: source hardcoded to 'snmp'
  it('ENV-API-06: source is hardcoded to snmp', async () => {
    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 23.5 },
      ]),
    });

    const rows = await (db as any).select().from(envReadings).all();
    expect(rows[0].source).toBe('snmp');
  });

  // ENV-API-07: GET /env-readings?meter_id=X returns readings
  it('ENV-API-07: GET ?meter_id returns env readings', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(envReadings).values([
      { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T10:00:00Z', tempCTenths: 235, humidityPctTenths: 450, source: 'snmp', createdAt: now },
    ]);

    const res = await app.request('/env-readings?meter_id=meter-001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].tempCTenths).toBe(235);
    expect(body[0].humidityPctTenths).toBe(450);
  });

  // ENV-API-08: time range filter
  it('ENV-API-08: GET with from/to filters by time range', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(envReadings).values([
      { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T08:00:00Z', tempCTenths: 220, humidityPctTenths: 400, source: 'snmp', createdAt: now },
      { id: 'er2', meterId: 'meter-001', timestamp: '2026-03-01T12:00:00Z', tempCTenths: 235, humidityPctTenths: 450, source: 'snmp', createdAt: now },
      { id: 'er3', meterId: 'meter-001', timestamp: '2026-03-01T18:00:00Z', tempCTenths: 250, humidityPctTenths: 500, source: 'snmp', createdAt: now },
    ]);

    const res = await app.request('/env-readings?meter_id=meter-001&from=2026-03-01T10:00:00Z&to=2026-03-01T14:00:00Z');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('er2');
  });

  // ENV-API-09: missing meter_id → 400
  it('ENV-API-09: GET without meter_id → 400', async () => {
    const res = await app.request('/env-readings');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  // ENV-API-10: meter belonging to different tenant → 403 on GET
  it('ENV-API-10: GET with meter_id from different tenant → 403', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(tenants).values({
      id: 'tenant-2', name: 'Other DC', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({
      id: 'meter-002', tenantId: 'tenant-2', name: 'Grid B', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });

    const res = await app.request('/env-readings?meter_id=meter-002');
    expect(res.status).toBe(403);
  });

  // ENV-API-11: GET /env-readings/latest returns latest per meter
  it('ENV-API-11: GET /latest returns most recent reading per meter', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(envReadings).values([
      { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T08:00:00Z', tempCTenths: 220, humidityPctTenths: 400, source: 'snmp', createdAt: now },
      { id: 'er2', meterId: 'meter-001', timestamp: '2026-03-01T12:00:00Z', tempCTenths: 250, humidityPctTenths: 500, source: 'snmp', createdAt: now },
    ]);

    const res = await app.request('/env-readings/latest');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].tempCTenths).toBe(250);
  });

  // ENV-API-12: temp_c exceeds alert threshold → alert_events row created
  it('ENV-API-12: exceeding alert threshold creates alert_event', async () => {
    const now = new Date().toISOString();
    // Rule: temperature > 30°C (300 tenths)
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', meterId: 'meter-001',
      metric: 'temperature', operator: 'gt', threshold: 300,
      severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });

    // Post temp_c=35.0 (350 tenths > 300 → triggers alert)
    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 35.0 },
      ]),
    });

    const events = await (db as any).select().from(alertEvents).all();
    expect(events).toHaveLength(1);
    expect(events[0].ruleId).toBe('rule-1');
    expect(events[0].value).toBe(350);
    expect(events[0].threshold).toBe(300);
  });

  // ENV-API-13: temp_c below threshold → no alert
  it('ENV-API-13: temp_c below threshold creates no alert_event', async () => {
    const now = new Date().toISOString();
    // Rule: temperature > 30°C (300 tenths)
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', meterId: 'meter-001',
      metric: 'temperature', operator: 'gt', threshold: 300,
      severity: 'warning', enabled: 1, createdAt: now, updatedAt: now,
    });

    // Post temp_c=25.0 (250 tenths < 300 → no alert)
    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 25.0 },
      ]),
    });

    const events = await (db as any).select().from(alertEvents).all();
    expect(events).toHaveLength(0);
  });

  // ENV-API-14: disabled alert rule → no alert
  it('ENV-API-14: disabled alert rule does not trigger alert', async () => {
    const now = new Date().toISOString();
    await (db as any).insert(alertRules).values({
      id: 'rule-1', tenantId: 'tenant-1', meterId: 'meter-001',
      metric: 'temperature', operator: 'gt', threshold: 300,
      severity: 'warning', enabled: 0, // disabled
      createdAt: now, updatedAt: now,
    });

    await app.request('/env-readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { meter_id: 'meter-001', timestamp: '2026-03-01T10:00:00Z', temp_c: 35.0 },
      ]),
    });

    const events = await (db as any).select().from(alertEvents).all();
    expect(events).toHaveLength(0);
  });
});
