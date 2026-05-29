import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { sustainability } from '../../src/routes/sustainability.js';
import { tenants, meters, powerReadings, recCertificates, carbonEmissions } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

const now = '2026-03-01T00:00:00Z';

describe('Sustainability Routes', () => {
  let db: Database;
  let adminApp: ReturnType<typeof createAppWithTenant>;
  let memberApp: ReturnType<typeof createAppWithTenant>;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;

    await (db as any).insert(tenants).values({ id: 'tenant-1', name: 'T1', stateCode: 'MH', createdAt: now, updatedAt: now });

    adminApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'admin' });
    adminApp.route('/sustainability', sustainability);

    memberApp = createAppWithTenant(db, 'tenant-1', { orgRole: 'org:member' });
    memberApp.route('/sustainability', sustainability);
  });

  // ─── REC CRUD ─────────────────────────────────────────────────

  it('GET /sustainability/recs — empty list', async () => {
    const res = await adminApp.request('/sustainability/recs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('POST /sustainability/recs — admin creates cert', async () => {
    const payload = {
      id: 'rec-001',
      certificateType: 'REC',
      serialNumber: 'IN-REC-2026-001',
      source: 'solar',
      mwh: 1000,
      vintagePeriodStart: '2026-03-01',
      vintagePeriodEnd: '2026-03-31',
    };

    const res = await adminApp.request('/sustainability/recs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('rec-001');
    expect(body.status).toBe('active');
    expect(body.tenantId).toBe('tenant-1');
  });

  it('POST /sustainability/recs — non-admin → 403', async () => {
    const res = await memberApp.request('/sustainability/recs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'rec-001',
        certificateType: 'REC',
        serialNumber: 'SN001',
        source: 'solar',
        mwh: 1000,
        vintagePeriodStart: '2026-03-01',
        vintagePeriodEnd: '2026-03-31',
      }),
    });
    expect(res.status).toBe(403);
  });

  it('POST /sustainability/recs — validation error on missing fields', async () => {
    const res = await adminApp.request('/sustainability/recs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'rec-001' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /sustainability/recs — paginated list after create', async () => {
    await (db as any).insert(recCertificates).values({
      id: 'rec-001', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar',
      mwh: 1000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'active',
      retiredAt: null, retiredAgainstPeriod: null, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/recs?limit=25&offset=0');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('POST /sustainability/recs/:id/retire — flips status to retired', async () => {
    await (db as any).insert(recCertificates).values({
      id: 'rec-001', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar',
      mwh: 1000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'active',
      retiredAt: null, retiredAgainstPeriod: null, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/recs/rec-001/retire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retiredAgainstPeriod: '2026-03' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('retired');
    expect(body.retiredAt).toBeTruthy();
    expect(body.retiredAgainstPeriod).toBe('2026-03');
  });

  it('POST /sustainability/recs/:id/retire — double-retire → 409', async () => {
    await (db as any).insert(recCertificates).values({
      id: 'rec-001', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar',
      mwh: 1000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'retired',
      retiredAt: now, retiredAgainstPeriod: null, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/recs/rec-001/retire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
  });

  // ─── Tenant scoping ────────────────────────────────────────────

  it('tenant scoping — tenant sees only its own RECs', async () => {
    await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'T2', stateCode: 'KA', createdAt: now, updatedAt: now });
    // Insert REC for tenant-2
    await (db as any).insert(recCertificates).values({
      id: 'rec-t2', tenantId: 'tenant-2', certificateType: 'REC', serialNumber: 'OTHER', source: 'wind',
      mwh: 5000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'active',
      retiredAt: null, retiredAgainstPeriod: null, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/recs');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  // ─── Emissions ─────────────────────────────────────────────────

  it('POST /sustainability/emissions/compute — with seeded readings + active RECs', async () => {
    // Seed meter + readings
    await (db as any).insert(meters).values({
      id: 'meter-1', tenantId: 'tenant-1', name: 'M1', stateCode: 'MH', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(powerReadings).values([
      { id: 'r1', meterId: 'meter-1', timestamp: '2026-03-15T00:00:00Z', kWh: 100_000, source: 'grid', createdAt: now },
      { id: 'r2', meterId: 'meter-1', timestamp: '2026-03-15T01:00:00Z', kWh: 20_000, source: 'solar', createdAt: now },
    ]);
    // Seed active REC: 10 MWh = 10000 milliunits = 10000 kWh offset
    await (db as any).insert(recCertificates).values({
      id: 'rec-001', tenantId: 'tenant-1', certificateType: 'REC', serialNumber: 'SN001', source: 'solar',
      mwh: 10_000, vintagePeriodStart: '2026-03-01', vintagePeriodEnd: '2026-03-31', status: 'active',
      retiredAt: null, retiredAgainstPeriod: null, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/emissions/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodStart: '2026-03-01T00:00:00Z',
        periodEnd: '2026-03-31T23:59:59Z',
        gridEmissionFactorGPerKwh: 710,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // nonRenewable = 100 kWh, renewable = 20 kWh
    // recOffset = min(10000, 100) = 100 kWh (capped at nonRenewable)
    expect(body.scope2GrossKg).toBe(Math.round(100 * 710 / 1000)); // 71 kg
    expect(body.scope2NetKg).toBe(0); // fully offset
    expect(body.tenantId).toBe('tenant-1');
    expect(body.periodStart).toBe('2026-03-01T00:00:00Z');
  });

  it('GET /sustainability/emissions — lists stored records', async () => {
    await (db as any).insert(carbonEmissions).values({
      id: 'em-001', tenantId: 'tenant-1', periodStart: '2026-03-01', periodEnd: '2026-03-31',
      gridEmissionFactorGPerKwh: 710, totalKwh: 100_000, renewableKwh: 0, recOffsetKwh: 0,
      scope2GrossKg: 71, scope2NetKg: 71, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/emissions?limit=25&offset=0');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].scope2GrossKg).toBe(71);
  });

  it('POST /sustainability/emissions/compute — non-admin → 403', async () => {
    const res = await memberApp.request('/sustainability/emissions/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart: '2026-03-01', periodEnd: '2026-03-31' }),
    });
    expect(res.status).toBe(403);
  });

  it('tenant scoping — emissions list returns only own tenant records', async () => {
    await (db as any).insert(tenants).values({ id: 'tenant-2', name: 'T2', stateCode: 'KA', createdAt: now, updatedAt: now });
    await (db as any).insert(carbonEmissions).values({
      id: 'em-t2', tenantId: 'tenant-2', periodStart: '2026-03-01', periodEnd: '2026-03-31',
      gridEmissionFactorGPerKwh: 710, totalKwh: 500_000, renewableKwh: 0, recOffsetKwh: 0,
      scope2GrossKg: 355, scope2NetKg: 355, createdAt: now, updatedAt: now,
    });

    const res = await adminApp.request('/sustainability/emissions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });
});
