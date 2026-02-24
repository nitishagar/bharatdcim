import {
  validateCSVFile, classifyReading,
} from '@bharatdcim/billing-engine';
import type { NormalizedRow, CSVError, TariffConfig } from '@bharatdcim/billing-engine';
import { powerReadings, uploadAudit } from '../db/schema.js';
import type { Database } from '../db/client.js';

export interface ImportResult {
  uploadId: string;
  fileName: string;
  format: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errors: CSVError[];
  warnings: CSVError[];
  metersAffected: string[];
  processingTimeMs: number;
}

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Import a CSV file: validate, classify ToD, insert readings, write audit.
 */
export async function importCSV(
  content: string,
  fileName: string,
  fileSize: number,
  tenantId: string,
  tariff: TariffConfig | null,
  db: Database,
): Promise<ImportResult> {
  const start = Date.now();
  const uploadId = generateId();

  // Validate and parse
  const validation = validateCSVFile(content);

  if (!validation.valid && validation.records.length === 0) {
    // Total failure — write audit and return
    const processingTimeMs = Date.now() - start;
    await writeAudit(db, {
      uploadId, tenantId, fileName, fileSize,
      format: validation.format,
      totalRows: 0, importedRows: 0, skippedRows: 0,
      errors: validation.errors, metersAffected: [],
      processingTimeMs,
    });
    return {
      uploadId, fileName, format: validation.format,
      totalRows: 0, importedRows: 0, skippedRows: 0,
      errors: validation.errors, warnings: validation.warnings,
      metersAffected: [], processingTimeMs,
    };
  }

  const records = validation.records;
  const totalRows = records.length + validation.errors.length;
  const metersAffected = [...new Set(records.map(r => r.meterId))];

  // Batch insert readings (500 at a time)
  const BATCH_SIZE = 500;
  let importedRows = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const rows = batch.map((record) => {
      // Classify ToD if tariff provided
      let slotType: string | undefined;
      let slotName: string | undefined;
      let ratePaisa: number | undefined;

      if (tariff) {
        const classification = classifyReading(new Date(record.timestamp), tariff);
        slotType = classification.slotType;
        slotName = classification.slotName;
        ratePaisa = classification.ratePaisa;
      }

      return {
        id: generateId(),
        meterId: record.meterId,
        timestamp: record.timestamp,
        kwhPaisa: Math.round(record.kWh * 100), // Store as integer for consistency
        source: record.source || null,
        slotType: slotType || null,
        slotName: slotName || null,
        ratePaisa: ratePaisa || null,
        uploadId,
        createdAt: new Date().toISOString(),
      };
    });

    await db.insert(powerReadings).values(rows);
    importedRows += batch.length;
  }

  const processingTimeMs = Date.now() - start;
  const skippedRows = totalRows - importedRows;

  await writeAudit(db, {
    uploadId, tenantId, fileName, fileSize,
    format: validation.format,
    totalRows, importedRows, skippedRows,
    errors: validation.errors, metersAffected,
    processingTimeMs,
  });

  return {
    uploadId, fileName, format: validation.format,
    totalRows, importedRows, skippedRows,
    errors: validation.errors, warnings: validation.warnings,
    metersAffected, processingTimeMs,
  };
}

async function writeAudit(
  db: Database,
  data: {
    uploadId: string; tenantId: string; fileName: string; fileSize: number;
    format: string; totalRows: number; importedRows: number; skippedRows: number;
    errors: CSVError[]; metersAffected: string[]; processingTimeMs: number;
  },
): Promise<void> {
  await db.insert(uploadAudit).values({
    id: data.uploadId,
    tenantId: data.tenantId,
    fileName: data.fileName,
    fileSize: data.fileSize,
    format: data.format,
    totalRows: data.totalRows,
    importedRows: data.importedRows,
    skippedRows: data.skippedRows,
    errorsJson: data.errors.length > 0 ? JSON.stringify(data.errors) : null,
    metersAffected: data.metersAffected.length > 0 ? JSON.stringify(data.metersAffected) : null,
    processingTimeMs: data.processingTimeMs,
    createdAt: new Date().toISOString(),
  });
}
