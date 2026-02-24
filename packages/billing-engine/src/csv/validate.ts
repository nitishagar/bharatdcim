/**
 * Full CSV file validation pipeline.
 * Composes parseCSV → detectFormat → normalize → validateRows
 */
import { parseCSV } from './parser.js';
import { detectDCIMFormat, type DCIMFormat } from './detect-format.js';
import { normalizeRows, type NormalizedRow } from './normalize.js';

export interface CSVError {
  code: string;
  row?: number;
  message: string;
}

export interface CSVValidationResult {
  valid: boolean;
  format: DCIMFormat;
  records: NormalizedRow[];
  errors: CSVError[];
  warnings: CSVError[];
}

/**
 * Validate a single normalized row.
 */
export function validateCSVRow(
  row: NormalizedRow,
  rowIndex: number,
  allTimestamps?: Map<string, Set<string>>,
): CSVError[] {
  const errors: CSVError[] = [];

  // Validate timestamp
  const ts = new Date(row.timestamp);
  if (isNaN(ts.getTime())) {
    errors.push({ code: 'INVALID_TIMESTAMP', row: rowIndex, message: `Invalid timestamp: ${row.timestamp}` });
  } else if (ts.getTime() > Date.now()) {
    errors.push({ code: 'FUTURE_TIMESTAMP', row: rowIndex, message: `Future timestamp: ${row.timestamp}` });
  }

  // Validate kWh
  if (isNaN(row.kWh)) {
    errors.push({ code: 'INVALID_KWH', row: rowIndex, message: `Invalid kWh value` });
  } else {
    if (row.kWh < 0) {
      errors.push({ code: 'NEGATIVE_KWH', row: rowIndex, message: `Negative kWh: ${row.kWh}` });
    }
    if (row.kWh > 10000) {
      errors.push({ code: 'UNREALISTIC_KWH', row: rowIndex, message: `Unrealistic kWh (>10000): ${row.kWh}` });
    }
  }

  // Check duplicate timestamp per meter
  if (allTimestamps) {
    const key = row.meterId;
    if (!allTimestamps.has(key)) {
      allTimestamps.set(key, new Set());
    }
    const meterTs = allTimestamps.get(key)!;
    if (meterTs.has(row.timestamp)) {
      errors.push({ code: 'DUPLICATE', row: rowIndex, message: `Duplicate timestamp for meter ${row.meterId}: ${row.timestamp}` });
    } else {
      meterTs.add(row.timestamp);
    }
  }

  return errors;
}

/**
 * Validate an entire CSV file.
 */
export function validateCSVFile(content: string): CSVValidationResult {
  // Strip BOM for empty check
  const cleaned = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

  if (cleaned.trim() === '') {
    return {
      valid: false,
      format: 'unknown',
      records: [],
      errors: [{ code: 'EMPTY_FILE', message: 'File is empty' }],
      warnings: [],
    };
  }

  const parsed = parseCSV(content);

  if (parsed.rows.length === 0) {
    return {
      valid: false,
      format: 'unknown',
      records: [],
      errors: [{ code: 'NO_DATA', message: 'File contains headers but no data rows' }],
      warnings: [],
    };
  }

  // Detect format
  const format = detectDCIMFormat(parsed.headers);

  // Check for required columns
  const lowerHeaders = parsed.headers.map(h => h.toLowerCase().trim());
  const hasKwh = lowerHeaders.some(h =>
    h === 'kwh' || h === 'energy (kwh)' || h === 'realenergy' || h === 'active_energy_wh',
  );
  if (!hasKwh) {
    return {
      valid: false,
      format,
      records: [],
      errors: [{ code: 'MISSING_COLUMN', message: 'Required column "kwh" not found' }],
      warnings: [],
    };
  }

  // Normalize
  const normalized = normalizeRows(parsed.rows, format);

  const warnings: CSVError[] = [];
  const errors: CSVError[] = [];
  const validRecords: NormalizedRow[] = [];
  const allTimestamps = new Map<string, Set<string>>();

  // Check for extra columns (only for bharatdcim format)
  if (format === 'bharatdcim') {
    const expectedCols = ['timestamp', 'meter_id', 'kwh', 'kw', 'voltage_v', 'current_a', 'power_factor', 'source'];
    const extraCols = parsed.headers.filter(h => !expectedCols.includes(h.toLowerCase()));
    if (extraCols.length > 0) {
      warnings.push({ code: 'EXTRA_COLUMNS', message: `Extra columns: ${extraCols.join(', ')}` });
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    const rowErrors = validateCSVRow(normalized[i], i + 1, allTimestamps);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRecords.push(normalized[i]);
    }
  }

  return {
    valid: errors.length === 0,
    format,
    records: validRecords,
    errors,
    warnings,
  };
}
