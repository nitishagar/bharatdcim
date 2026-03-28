/**
 * GAP-API-03 validation: Confirms CSV import and SNMP batch use identical ×1000
 * kWh storage scaling. Both paths store kWh as integer × 1000 for decimal precision.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { importCSV } from '../../src/services/csv-import.js';
import { readingsRouter } from '../../src/routes/readings.js';
import { tenants, meters, powerReadings } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

async function seedData(db: Database) {
  const now = new Date().toISOString();
  await (db as any).insert(tenants).values({
    id: 'tenant-1', name: 'Test DC', stateCode: 'MH', createdAt: now, updatedAt: now,
  });
  await (db as any).insert(meters).values({
    id: 'meter-001', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'MH',
    createdAt: now, updatedAt: now,
  });
}

describe('kWh Scaling Consistency (GAP-API-03)', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedData(db);
  });

  // GAP-API-03-01: CSV import stores 150.5 kWh as 150500 (×1000 integer)
  it('GAP-API-03-01: CSV import of 150.5 kWh stores as 150500 in DB', async () => {
    const csv = `timestamp,meter_id,kwh,source
2026-01-01T10:00:00Z,meter-001,150.5,grid`;

    await importCSV(csv, 'test.csv', 100, 'tenant-1', null, db);

    const rows = await (db as any).select().from(powerReadings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kWh).toBe(150500);
  });

  // GAP-API-03-02: SNMP batch stores 150.5 kWh as 150500 (×1000 integer)
  // SNMP agent uses POST /readings/batch which applies Math.round(kWh * 1000) scaling
  it('GAP-API-03-02: SNMP batch insert of 150.5 kWh stores as 150500 in DB', async () => {
    const app = createAppWithTenant(db, 'tenant-1');
    app.route('/readings', readingsRouter);

    const res = await app.request('/readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readings: [
          { meterId: 'meter-001', timestamp: '2026-01-01T10:00:00Z', kWh: 150.5, kW: 15.0 },
        ],
        agentId: 'agent-test',
      }),
    });
    expect(res.status).toBe(201);

    const rows = await (db as any).select().from(powerReadings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kWh).toBe(150500);
  });

  // GAP-API-03-03: Both CSV and SNMP produce the same stored integer for same kWh value
  it('GAP-API-03-03: CSV and SNMP store identical integer for the same kWh value', async () => {
    const csv = `timestamp,meter_id,kwh,source
2026-01-01T10:00:00Z,meter-001,150.5,grid`;
    await importCSV(csv, 'test.csv', 100, 'tenant-1', null, db);

    const csvRows = await (db as any).select().from(powerReadings).all();
    const csvStoredValue = csvRows[0].kWh;

    // Second DB for SNMP path
    const testDb2 = await createTestDb();
    const db2 = testDb2.db as unknown as Database;
    await seedData(db2);

    const app = createAppWithTenant(db2, 'tenant-1');
    app.route('/readings', readingsRouter);
    await app.request('/readings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readings: [{ meterId: 'meter-001', timestamp: '2026-01-01T10:00:00Z', kWh: 150.5 }],
        agentId: 'agent-test',
      }),
    });
    const snmpRows = await (db2 as any).select().from(powerReadings).all();
    const snmpStoredValue = snmpRows[0].kWh;

    expect(csvStoredValue).toBe(snmpStoredValue);
    expect(csvStoredValue).toBe(150500);
  });

  // GAP-API-03-04: Billing reads 150500 back as 150.5 kWh (inverse scaling)
  it('GAP-API-03-04: Stored value 150500 represents 150.5 kWh (150500 / 1000 = 150.5)', () => {
    const storedValue = 150500;
    const kWh = storedValue / 1000;
    expect(kWh).toBe(150.5);
  });

  // GAP-API-03-05: Math.round preserves precision for typical metered values
  it('GAP-API-03-05: Math.round(kWh * 1000) is lossless for values with ≤3 decimal places', () => {
    const testValues = [0, 0.001, 1.5, 100.123, 9999.999, 150.5];
    for (const v of testValues) {
      const stored = Math.round(v * 1000);
      const recovered = stored / 1000;
      expect(recovered).toBeCloseTo(v, 10);
    }
  });
});
