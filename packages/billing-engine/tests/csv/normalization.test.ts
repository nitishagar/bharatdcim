import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, detectDCIMFormat, normalizeRows } from '../../src/csv/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, '..', 'fixtures', 'csv');
const readFixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf-8');

describe('Normalization', () => {
  // CSV-040: Nlyte format normalization
  it('CSV-040: Nlyte Energy (kWh) 125.5 → 125.5', () => {
    const parsed = parseCSV(readFixture('nlyte-export.csv'));
    const format = detectDCIMFormat(parsed.headers);
    expect(format).toBe('nlyte');

    const normalized = normalizeRows(parsed.rows, format);
    expect(normalized[0].kWh).toBe(125.5);
    expect(normalized[0].meterId).toBe('PDU-A-01');
  });

  // CSV-041: EcoStruxure Active_Energy_Wh → kWh conversion
  it('CSV-041: EcoStruxure Active_Energy_Wh 125500 → 125.5 kWh', () => {
    const parsed = parseCSV(readFixture('ecostruxure-export.csv'));
    const format = detectDCIMFormat(parsed.headers);
    expect(format).toBe('ecostruxure');

    const normalized = normalizeRows(parsed.rows, format);
    expect(normalized[0].kWh).toBe(125.5);
    expect(normalized[0].meterId).toBe('EQ-001');
  });

  // CSV-042: Sunbird RealEnergy → kWh
  it('CSV-042: Sunbird RealEnergy 125.5 → 125.5 kWh', () => {
    const parsed = parseCSV(readFixture('sunbird-export.csv'));
    const format = detectDCIMFormat(parsed.headers);
    expect(format).toBe('sunbird');

    const normalized = normalizeRows(parsed.rows, format);
    expect(normalized[0].kWh).toBe(125.5);
    expect(normalized[0].meterId).toBe('PDU-B-02');
  });
});
