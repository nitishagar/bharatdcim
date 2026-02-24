/**
 * Normalize rows from various vendor CSV formats into a standard BharatDCIM format.
 */
import type { DCIMFormat } from './detect-format.js';

export interface NormalizedRow {
  timestamp: string;
  meterId: string;
  kWh: number;
  kW?: number;
  voltageV?: number;
  currentA?: number;
  powerFactor?: number;
  source?: string;
}

/**
 * Normalize a single row from BharatDCIM native format.
 */
function normalizeBharatDCIM(row: Record<string, string>): NormalizedRow {
  return {
    timestamp: row['timestamp'],
    meterId: row['meter_id'],
    kWh: parseFloat(row['kwh']),
    kW: row['kw'] ? parseFloat(row['kw']) : undefined,
    voltageV: row['voltage_v'] ? parseFloat(row['voltage_v']) : undefined,
    currentA: row['current_a'] ? parseFloat(row['current_a']) : undefined,
    powerFactor: row['power_factor'] ? parseFloat(row['power_factor']) : undefined,
    source: row['source'] || undefined,
  };
}

/**
 * Normalize a single row from Nlyte format.
 * Columns: Device Name, Reading Date, Energy (kWh)
 */
function normalizeNlyte(row: Record<string, string>): NormalizedRow {
  return {
    timestamp: row['Reading Date'],
    meterId: row['Device Name'],
    kWh: parseFloat(row['Energy (kWh)']),
  };
}

/**
 * Normalize a single row from Sunbird dcTrack format.
 * Columns: AssetName, Timestamp, RealEnergy
 */
function normalizeSunbird(row: Record<string, string>): NormalizedRow {
  return {
    timestamp: row['Timestamp'],
    meterId: row['AssetName'],
    kWh: parseFloat(row['RealEnergy']),
  };
}

/**
 * Normalize a single row from Schneider EcoStruxure IT format.
 * Columns: Equipment_ID, Date_Time, Active_Energy_Wh
 * Note: EcoStruxure exports energy in Wh, not kWh.
 */
function normalizeEcoStruxure(row: Record<string, string>): NormalizedRow {
  return {
    timestamp: row['Date_Time'],
    meterId: row['Equipment_ID'],
    kWh: parseFloat(row['Active_Energy_Wh']) / 1000, // Wh → kWh
  };
}

/**
 * Normalize all rows based on detected format.
 */
export function normalizeRows(rows: Record<string, string>[], format: DCIMFormat): NormalizedRow[] {
  switch (format) {
    case 'bharatdcim':
      return rows.map(normalizeBharatDCIM);
    case 'nlyte':
      return rows.map(normalizeNlyte);
    case 'sunbird':
      return rows.map(normalizeSunbird);
    case 'ecostruxure':
      return rows.map(normalizeEcoStruxure);
    case 'unknown':
      // Best-effort: try to match common column names
      return rows.map(normalizeBharatDCIM);
  }
}
