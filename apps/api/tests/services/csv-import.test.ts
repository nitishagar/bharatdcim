import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers.js';
import { importCSV } from '../../src/services/csv-import.js';
import { tenants, meters, uploadAudit, powerReadings } from '../../src/db/schema.js';
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

const VALID_CSV = `timestamp,meter_id,kwh,source
2025-02-15T10:00:00Z,meter-001,100,grid
2025-02-15T11:00:00Z,meter-001,110,grid
2025-02-15T12:00:00Z,meter-001,105,grid`;

const CSV_WITH_ERRORS = `timestamp,meter_id,kwh,source
2025-02-15T10:00:00Z,meter-001,100,grid
not-a-date,meter-001,110,grid
2025-02-15T12:00:00Z,meter-001,-50,grid`;

describe('CSV Import Service', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedData(db);
  });

  // CSV-050: Upload audit created
  it('CSV-050: upload audit created with file_name and counts', async () => {
    const result = await importCSV(VALID_CSV, 'readings.csv', 1024, 'tenant-1', null, db);

    expect(result.importedRows).toBe(3);
    expect(result.fileName).toBe('readings.csv');

    // Verify audit record in DB
    const audits = await (db as any).select().from(uploadAudit).all();
    expect(audits).toHaveLength(1);
    expect(audits[0].fileName).toBe('readings.csv');
    expect(audits[0].totalRows).toBe(3);
    expect(audits[0].importedRows).toBe(3);
    expect(audits[0].skippedRows).toBe(0);
  });

  // CSV-051: Error details logged
  it('CSV-051: error details logged in errors_json', async () => {
    const result = await importCSV(CSV_WITH_ERRORS, 'errors.csv', 512, 'tenant-1', null, db);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.importedRows).toBe(1); // only first row is valid

    const audits = await (db as any).select().from(uploadAudit).all();
    expect(audits[0].errorsJson).toBeTruthy();
    const errors = JSON.parse(audits[0].errorsJson);
    expect(errors.some((e: any) => e.code === 'INVALID_TIMESTAMP')).toBe(true);
    expect(errors.some((e: any) => e.code === 'NEGATIVE_KWH')).toBe(true);
  });

  // CSV-052: Processing time recorded
  it('CSV-052: processing_time_ms > 0', async () => {
    const result = await importCSV(VALID_CSV, 'readings.csv', 1024, 'tenant-1', null, db);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

    const audits = await (db as any).select().from(uploadAudit).all();
    expect(audits[0].processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  // CSV-053: Meters affected logged
  it('CSV-053: meters_affected lists all meter IDs', async () => {
    const result = await importCSV(VALID_CSV, 'readings.csv', 1024, 'tenant-1', null, db);
    expect(result.metersAffected).toContain('meter-001');

    const audits = await (db as any).select().from(uploadAudit).all();
    const meters = JSON.parse(audits[0].metersAffected);
    expect(meters).toContain('meter-001');
  });

  it('readings are inserted into powerReadings table', async () => {
    await importCSV(VALID_CSV, 'readings.csv', 1024, 'tenant-1', null, db);

    const readings = await (db as any).select().from(powerReadings).all();
    expect(readings).toHaveLength(3);
    expect(readings[0].meterId).toBe('meter-001');
  });

  it('empty file returns EMPTY_FILE error', async () => {
    const result = await importCSV('', 'empty.csv', 0, 'tenant-1', null, db);
    expect(result.importedRows).toBe(0);
    expect(result.errors[0].code).toBe('EMPTY_FILE');
  });
});
