/**
 * Detect which DCIM vendor exported a CSV based on header names.
 */
export type DCIMFormat = 'bharatdcim' | 'nlyte' | 'sunbird' | 'ecostruxure' | 'unknown';

const FORMAT_SIGNATURES: Record<string, DCIMFormat> = {};

// Header patterns for each vendor
const BHARATDCIM_HEADERS = ['timestamp', 'meter_id', 'kwh'];
const NLYTE_HEADERS = ['device name', 'reading date', 'energy (kwh)'];
const SUNBIRD_HEADERS = ['assetname', 'timestamp', 'realenergy'];
const ECOSTRUXURE_HEADERS = ['equipment_id', 'date_time', 'active_energy_wh'];

function headersMatch(actual: string[], expected: string[]): boolean {
  const lower = actual.map(h => h.toLowerCase().trim());
  return expected.every(e => lower.includes(e));
}

export function detectDCIMFormat(headers: string[]): DCIMFormat {
  if (headersMatch(headers, BHARATDCIM_HEADERS)) return 'bharatdcim';
  if (headersMatch(headers, NLYTE_HEADERS)) return 'nlyte';
  if (headersMatch(headers, SUNBIRD_HEADERS)) return 'sunbird';
  if (headersMatch(headers, ECOSTRUXURE_HEADERS)) return 'ecostruxure';
  return 'unknown';
}
