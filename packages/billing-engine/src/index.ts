// @bharatdcim/billing-engine
// Core billing calculation library — pure computation, zero IO

export { calculateBill } from './calculate.js';
export { classifyReading, classifyReadingWithProRating, calculateSlotRate } from './tod.js';
export { calculateBilledDemand } from './demand.js';

// Invoice engine
export { determineTaxType, validateGSTIN, calculateInvoiceTax } from './invoice/gst.js';
export type { TaxType, GSTINValidation, TaxBreakdown } from './invoice/gst.js';
export { getFinancialYear, formatInvoiceNumber, formatCreditNoteNumber } from './invoice/numbering.js';
export { validateCreditNote } from './invoice/credit-note.js';
export type { CreditNoteValidation } from './invoice/credit-note.js';

// CSV import pipeline
export { parseCSV, detectDCIMFormat, normalizeRows, validateCSVFile, validateCSVRow } from './csv/index.js';
export type { ParsedCSV, DCIMFormat, NormalizedRow, CSVError, CSVValidationResult } from './csv/index.js';

export type * from './types.js';
