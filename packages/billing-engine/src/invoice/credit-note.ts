/**
 * Validate whether a credit note can be issued.
 *
 * Business rules:
 * 1. Credit note amount must not exceed the original invoice amount
 * 2. Credit note must be issued before September 30 of the next financial year
 *    (or the date of filing annual return, whichever is earlier)
 *    — per GST Section 34
 */
export interface CreditNoteValidation {
  valid: boolean;
  error?: string;
}

/**
 * Get the deadline for issuing a credit note for an invoice.
 * Per GST Section 34: September 30 of the FY following the FY of the original invoice.
 */
function getCreditNoteDeadline(invoiceDate: Date): Date {
  const year = invoiceDate.getFullYear();
  const month = invoiceDate.getMonth(); // 0-indexed

  // Determine the FY of the original invoice
  // If month >= April (3), FY ends March of next year
  // If month < April (0-2), FY ends March of this year
  const fyEndYear = month >= 3 ? year + 1 : year;

  // Deadline is September 30 of the NEXT FY
  // Next FY ends March of (fyEndYear + 1)
  // So deadline is September 30 of (fyEndYear)
  return new Date(fyEndYear, 8, 30, 23, 59, 59, 999); // Month 8 = September
}

export function validateCreditNote(
  amountPaisa: number,
  originalInvoiceAmountPaisa: number,
  creditNoteDate: Date,
  originalInvoiceDate: Date,
): CreditNoteValidation {
  // Rule 1: Amount must not exceed original
  if (amountPaisa > originalInvoiceAmountPaisa) {
    return {
      valid: false,
      error: `Credit note amount (${amountPaisa} paisa) exceeds original invoice amount (${originalInvoiceAmountPaisa} paisa)`,
    };
  }

  // Rule 2: Must be issued before September 30 of next FY
  const deadline = getCreditNoteDeadline(originalInvoiceDate);
  if (creditNoteDate > deadline) {
    const deadlineStr = deadline.toISOString().split('T')[0];
    return {
      valid: false,
      error: `Credit note must be issued before ${deadlineStr} (September 30 of next FY)`,
    };
  }

  return { valid: true };
}
