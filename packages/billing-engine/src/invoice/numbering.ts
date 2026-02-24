/**
 * Get the financial year string for a given date.
 * Indian FY runs April 1 to March 31.
 * April 2025 to March 2026 → '2526'
 * April 2026 to March 2027 → '2627'
 */
export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: 0=Jan, 3=Apr

  // If month >= April (3), FY starts this year
  // If month < April (0-2), FY started previous year
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;

  // Return last 2 digits of each year
  const startStr = String(fyStart).slice(-2);
  const endStr = String(fyEnd).slice(-2);
  return `${startStr}${endStr}`;
}

/**
 * Format an invoice number: INV/{FY}/{6-digit sequence}
 * Example: INV/2627/000001
 * Max length: 16 characters (INV/XXYY/NNNNNN)
 */
export function formatInvoiceNumber(fy: string, sequence: number): string {
  const padded = String(sequence).padStart(6, '0');
  return `INV/${fy}/${padded}`;
}

/**
 * Format a credit note number: CRN/{FY}/{6-digit sequence}
 * Example: CRN/2627/000001
 * Max length: 16 characters (CRN/XXYY/NNNNNN)
 */
export function formatCreditNoteNumber(fy: string, sequence: number): string {
  const padded = String(sequence).padStart(6, '0');
  return `CRN/${fy}/${padded}`;
}
