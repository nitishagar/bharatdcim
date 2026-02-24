import { eq } from 'drizzle-orm';
import {
  determineTaxType, calculateInvoiceTax, validateGSTIN,
  getFinancialYear, formatInvoiceNumber, formatCreditNoteNumber,
  validateCreditNote,
} from '@bharatdcim/billing-engine';
import type { TaxType } from '@bharatdcim/billing-engine';
import { bills, invoices, invoiceSequences, creditNotes, invoiceAuditLog } from '../db/schema.js';
import type { Database } from '../db/client.js';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Atomically get next invoice sequence number for a financial year.
 * Creates the sequence row if it doesn't exist.
 */
async function nextSequence(db: Database, financialYear: string): Promise<number> {
  const now = new Date().toISOString();

  // Try to get existing sequence
  const existing = await db
    .select()
    .from(invoiceSequences)
    .where(eq(invoiceSequences.financialYear, financialYear))
    .all();

  if (existing.length === 0) {
    // Create new sequence starting at 1
    await db.insert(invoiceSequences).values({
      id: generateId(),
      financialYear,
      lastSequence: 1,
      updatedAt: now,
    });
    return 1;
  }

  const nextSeq = existing[0].lastSequence + 1;
  await db
    .update(invoiceSequences)
    .set({ lastSequence: nextSeq, updatedAt: now })
    .where(eq(invoiceSequences.financialYear, financialYear));
  return nextSeq;
}

/**
 * Create an invoice from a bill.
 * Performs tax calculation, generates invoice number, creates audit log.
 */
export async function createInvoice(
  billId: string,
  supplierGSTIN: string,
  recipientGSTIN: string,
  db: Database,
): Promise<{ invoice: typeof invoices.$inferSelect; invoiceNumber: string }> {
  // Validate GSTINs
  const supplierVal = validateGSTIN(supplierGSTIN);
  if (!supplierVal.valid) {
    throw new Error(`Invalid supplier GSTIN: ${supplierVal.error}`);
  }
  const recipientVal = validateGSTIN(recipientGSTIN);
  if (!recipientVal.valid) {
    throw new Error(`Invalid recipient GSTIN: ${recipientVal.error}`);
  }

  // Fetch bill
  const billRows = await db.select().from(bills).where(eq(bills.id, billId)).all();
  if (billRows.length === 0) {
    throw new Error(`Bill ${billId} not found`);
  }
  const bill = billRows[0];

  if (bill.status === 'invoiced') {
    throw new Error(`Bill ${billId} is already invoiced`);
  }

  // Determine tax type and calculate tax
  const taxType: TaxType = determineTaxType(supplierGSTIN, recipientGSTIN);
  const taxBreakdown = calculateInvoiceTax(bill.subtotalPaisa, taxType);

  // Generate invoice number
  const now = new Date();
  const fy = getFinancialYear(now);
  const seq = await nextSequence(db, fy);
  const invoiceNumber = formatInvoiceNumber(fy, seq);

  const invoiceId = generateId();
  const nowStr = now.toISOString();

  const invoiceRow = {
    id: invoiceId,
    billId,
    tenantId: bill.tenantId,
    invoiceNumber,
    financialYear: fy,
    supplierGstin: supplierGSTIN,
    recipientGstin: recipientGSTIN,
    taxType: taxBreakdown.taxType,
    taxableAmountPaisa: bill.subtotalPaisa,
    cgstPaisa: taxBreakdown.cgstPaisa,
    sgstPaisa: taxBreakdown.sgstPaisa,
    igstPaisa: taxBreakdown.igstPaisa,
    totalTaxPaisa: taxBreakdown.totalTaxPaisa,
    totalAmountPaisa: taxBreakdown.totalAmountPaisa,
    status: 'draft',
    invoiceDate: nowStr,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  await db.insert(invoices).values(invoiceRow);

  // Update bill status
  await db.update(bills).set({ status: 'invoiced', updatedAt: nowStr }).where(eq(bills.id, billId));

  // Audit log
  await db.insert(invoiceAuditLog).values({
    id: generateId(),
    invoiceId,
    action: 'created',
    detailsJson: JSON.stringify({ billId, taxType: taxBreakdown.taxType }),
    createdAt: nowStr,
  });

  const inserted = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  return { invoice: inserted[0], invoiceNumber };
}

/**
 * Cancel an invoice. Marks status as 'cancelled' and logs audit.
 */
export async function cancelInvoice(
  invoiceId: string,
  reason: string,
  db: Database,
): Promise<typeof invoices.$inferSelect> {
  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  if (rows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const invoice = rows[0];
  if (invoice.status === 'cancelled') {
    throw new Error(`Invoice ${invoiceId} is already cancelled`);
  }

  const now = new Date().toISOString();

  await db
    .update(invoices)
    .set({ status: 'cancelled', updatedAt: now })
    .where(eq(invoices.id, invoiceId));

  // Revert bill status to 'finalized' (available for re-invoicing)
  await db
    .update(bills)
    .set({ status: 'draft', updatedAt: now })
    .where(eq(bills.id, invoice.billId));

  // Audit log
  await db.insert(invoiceAuditLog).values({
    id: generateId(),
    invoiceId,
    action: 'cancelled',
    detailsJson: JSON.stringify({ reason }),
    createdAt: now,
  });

  const updated = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  return updated[0];
}

/**
 * Create a credit note for an invoice.
 */
export async function createCreditNote(
  invoiceId: string,
  amountPaisa: number,
  reason: string,
  db: Database,
): Promise<typeof creditNotes.$inferSelect> {
  // Fetch original invoice
  const invoiceRows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  if (invoiceRows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }
  const invoice = invoiceRows[0];

  // Validate credit note
  const validation = validateCreditNote(
    amountPaisa,
    invoice.totalAmountPaisa,
    new Date(),
    new Date(invoice.invoiceDate),
  );
  if (!validation.valid) {
    throw new Error(validation.error!);
  }

  // Calculate tax on credit note amount (same tax type as original)
  const taxBreakdown = calculateInvoiceTax(amountPaisa, invoice.taxType as TaxType);

  // Generate credit note number
  const now = new Date();
  const fy = getFinancialYear(now);
  const seq = await nextSequence(db, fy);
  const creditNoteNumber = formatCreditNoteNumber(fy, seq);

  const creditNoteId = generateId();
  const nowStr = now.toISOString();

  const creditNoteRow = {
    id: creditNoteId,
    invoiceId,
    creditNoteNumber,
    financialYear: fy,
    amountPaisa,
    taxType: invoice.taxType,
    cgstPaisa: taxBreakdown.cgstPaisa,
    sgstPaisa: taxBreakdown.sgstPaisa,
    igstPaisa: taxBreakdown.igstPaisa,
    totalTaxPaisa: taxBreakdown.totalTaxPaisa,
    totalAmountPaisa: taxBreakdown.totalAmountPaisa,
    reason,
    status: 'draft',
    creditNoteDate: nowStr,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  await db.insert(creditNotes).values(creditNoteRow);

  // Audit log
  await db.insert(invoiceAuditLog).values({
    id: generateId(),
    invoiceId,
    action: 'credit_note_issued',
    detailsJson: JSON.stringify({ creditNoteId, amountPaisa, reason }),
    createdAt: nowStr,
  });

  const inserted = await db.select().from(creditNotes).where(eq(creditNotes.id, creditNoteId)).all();
  return inserted[0];
}
