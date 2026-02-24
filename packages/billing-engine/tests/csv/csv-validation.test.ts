import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, validateCSVFile, validateCSVRow } from '../../src/csv/index.js';
import type { NormalizedRow } from '../../src/csv/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures', 'csv');
const readFixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf-8');

describe('CSV Validation', () => {
  // CSV-001: Valid 3-row file
  it('CSV-001: valid 3-row file succeeds', () => {
    const result = validateCSVFile(readFixture('valid-3rows.csv'));
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
  });

  // CSV-002: Missing 'kwh' column
  it('CSV-002: missing kwh column → MISSING_COLUMN', () => {
    const result = validateCSVFile(readFixture('missing-kwh-column.csv'));
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('MISSING_COLUMN');
  });

  // CSV-003: Extra columns → success with warning
  it('CSV-003: extra columns → success with warning', () => {
    const csv = `timestamp,meter_id,kwh,source,extra_col,notes
2025-02-15T10:00:00Z,meter-001,100,grid,foo,bar
2025-02-15T11:00:00Z,meter-001,110,grid,baz,qux`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(2);
    expect(result.warnings.some(w => w.code === 'EXTRA_COLUMNS')).toBe(true);
  });

  // CSV-004: Wrong column order → success (auto-map by name)
  it('CSV-004: wrong column order → success', () => {
    const csv = `kwh,timestamp,meter_id,source
100,2025-02-15T10:00:00Z,meter-001,grid
110,2025-02-15T11:00:00Z,meter-001,grid`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].kWh).toBe(100);
  });

  // CSV-005: Future timestamp
  it('CSV-005: future timestamp → FUTURE_TIMESTAMP', () => {
    const csv = `timestamp,meter_id,kwh
2099-01-01T00:00:00Z,meter-001,100`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('FUTURE_TIMESTAMP');
  });

  // CSV-006: Invalid timestamp
  it('CSV-006: invalid timestamp → INVALID_TIMESTAMP', () => {
    const csv = `timestamp,meter_id,kwh
not-a-date,meter-001,100`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('INVALID_TIMESTAMP');
  });

  // CSV-007: Negative kWh
  it('CSV-007: negative kWh → NEGATIVE_KWH', () => {
    const csv = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-001,-50`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('NEGATIVE_KWH');
  });

  // CSV-008: Unrealistic kWh (>10000)
  it('CSV-008: unrealistic kWh (>10000) → UNREALISTIC_KWH', () => {
    const csv = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-001,50000`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('UNREALISTIC_KWH');
  });

  // CSV-009: Duplicate timestamp per meter
  it('CSV-009: duplicate timestamp per meter → DUPLICATE', () => {
    const csv = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-001,100
2025-02-15T10:00:00Z,meter-001,110`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE')).toBe(true);
  });

  // CSV-010: Overlapping time range (treated as duplicate for same meter+time)
  it('CSV-010: overlapping records → DUPLICATE', () => {
    const csv = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-001,100
2025-02-15T10:30:00Z,meter-001,105
2025-02-15T10:00:00Z,meter-001,102`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'DUPLICATE')).toBe(true);
  });

  // CSV-011: Empty file
  it('CSV-011: empty file → EMPTY_FILE', () => {
    const result = validateCSVFile('');
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('EMPTY_FILE');
  });

  // CSV-012: Header only, no data
  it('CSV-012: header only → NO_DATA', () => {
    const result = validateCSVFile('timestamp,meter_id,kwh\n');
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('NO_DATA');
  });

  // CSV-013: Single data row
  it('CSV-013: single data row succeeds', () => {
    const csv = `timestamp,meter_id,kwh
2025-02-15T10:00:00Z,meter-001,100`;
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(1);
  });

  // CSV-014: Large file (100 rows, not 100K for speed)
  it('CSV-014: large file batched successfully', () => {
    const header = 'timestamp,meter_id,kwh';
    const rows = Array.from({ length: 100 }, (_, i) => {
      // Spread across multiple days to avoid hour overflow
      const day = String(15 + Math.floor(i / 24)).padStart(2, '0');
      const hour = String(i % 24).padStart(2, '0');
      return `2025-02-${day}T${hour}:00:00Z,meter-001,${100 + i}`;
    });
    const csv = [header, ...rows].join('\n');
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(100);
  });

  // CSV-015: UTF-8 BOM
  it('CSV-015: UTF-8 BOM stripped correctly', () => {
    const csv = '\uFEFFtimestamp,meter_id,kwh\n2025-02-15T10:00:00Z,meter-001,100';
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.format).toBe('bharatdcim');
  });

  // CSV-016: Quoted commas
  it('CSV-016: quoted commas parsed correctly', () => {
    const csv = `timestamp,meter_id,kwh,source
2025-02-15T10:00:00Z,"meter-001,building-A",100,"grid, main"`;
    const parsed = parseCSV(csv);
    expect(parsed.rows[0]['meter_id']).toBe('meter-001,building-A');
    expect(parsed.rows[0]['source']).toBe('grid, main');
  });

  // CSV-017: Mixed line endings
  it('CSV-017: mixed line endings normalized', () => {
    const csv = 'timestamp,meter_id,kwh\r\n2025-02-15T10:00:00Z,meter-001,100\r2025-02-15T11:00:00Z,meter-001,110\n2025-02-15T12:00:00Z,meter-001,105';
    const result = validateCSVFile(csv);
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(3);
  });

  // CSV-018: Semicolon delimiter
  it('CSV-018: semicolon delimiter auto-detected', () => {
    const result = validateCSVFile(readFixture('semicolon-delimited.csv'));
    expect(result.valid).toBe(true);
    expect(result.records).toHaveLength(3);
  });
});
