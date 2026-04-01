import { eq, sql } from 'drizzle-orm';
import {
  determineTaxType, calculateInvoiceTax, validateGSTIN,
  getFinancialYear, formatInvoiceNumber, formatCreditNoteNumber,
  validateCreditNote, buildIrpPayload,
} from '@bharatdcim/billing-engine';
import type { TaxType } from '@bharatdcim/billing-engine';
import { bills, invoices, invoiceSequences, creditNotes, invoiceAuditLog, irpRetryQueue, tenants, tariffConfigs } from '../db/schema.js';
import type { Database } from '../db/client.js';
import type { Bindings } from '../types.js';
import { generateIrn, cancelIrn, buildGspConfig, buildPlatformSeller, mapReasonToCode } from './irp.js';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Atomically get next invoice sequence number for a financial year.
 * Uses INSERT ... ON CONFLICT DO UPDATE ... RETURNING for atomicity.
 */
async function nextSequence(db: Database, financialYear: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .insert(invoiceSequences)
    .values({ id: generateId(), financialYear, lastSequence: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: invoiceSequences.financialYear,
      set: {
        lastSequence: sql`${invoiceSequences.lastSequence} + 1`,
        updatedAt: now,
      },
    })
    .returning({ lastSequence: invoiceSequences.lastSequence });
  return result[0].lastSequence;
}

/**
 * Asynchronously trigger IRP generation for an invoice or credit note.
 * Guards against missing tenant address — sets not_applicable and returns.
 */
async function triggerIrpGeneration(
  invoice: typeof invoices.$inferSelect,
  bill: typeof bills.$inferSelect,
  tenant: typeof tenants.$inferSelect,
  env: Bindings,
  db: Database,
  docType: 'INV' | 'CRN' = 'INV',
  originalInvoice?: typeof invoices.$inferSelect,
  gstRateBps = 1800,
): Promise<void> {
  const now = new Date().toISOString();

  // Guard: if tenant has no address1 or pincode, skip IRP
  if (!tenant.address1 || !tenant.pincode) {
    await db.update(invoices)
      .set({ eInvoiceStatus: 'not_applicable', updatedAt: now })
      .where(eq(invoices.id, invoice.id));
    return;
  }

  const seller = buildPlatformSeller(env);
  const buyer = {
    lglNm: tenant.legalName ?? tenant.name,
    addr1: tenant.address1,
    loc: tenant.city ?? '',
    pin: parseInt(tenant.pincode, 10),
  };

  const payload = buildIrpPayload({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    docType,
    supplierGstin: env.PLATFORM_GSTIN ?? invoice.supplierGstin,
    recipientGstin: invoice.recipientGstin,
    taxType: invoice.taxType as TaxType,
    taxableAmountPaisa: invoice.taxableAmountPaisa,
    cgstPaisa: invoice.cgstPaisa,
    sgstPaisa: invoice.sgstPaisa,
    igstPaisa: invoice.igstPaisa,
    totalAmountPaisa: invoice.totalAmountPaisa,
    totalKwh: bill.totalKwh,
    gstRateBps,
    seller,
    buyer,
    originalInvoiceNumber: originalInvoice?.invoiceNumber,
    originalInvoiceDate: originalInvoice?.invoiceDate,
  });

  try {
    const irnResult = await generateIrn(payload, buildGspConfig(env));
    await db.update(invoices).set({
      irn: irnResult.irn,
      ackNo: irnResult.ackNo,
      ackDt: irnResult.ackDt,
      signedQrCode: irnResult.signedQrCode,
      eInvoiceStatus: 'irn_generated',
      irnGeneratedAt: now,
      updatedAt: now,
    }).where(eq(invoices.id, invoice.id));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // Enqueue for retry — next attempt in 5 minutes
    const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await db.insert(irpRetryQueue).values({
      id: generateId(),
      invoiceId: invoice.id,
      documentType: docType,
      attemptCount: 0,
      nextRetryAt,
      errorMessage,
      payloadJson: JSON.stringify(payload),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Create an invoice from a bill.
 * Performs tax calculation, generates invoice number, creates audit log.
 * Triggers async IRP generation via ctx.waitUntil.
 */
export async function createInvoice(
  billId: string,
  supplierGSTIN: string,
  recipientGSTIN: string,
  db: Database,
  tenantId: string | null = null,
  env?: Bindings,
  ctx: { waitUntil(p: Promise<unknown>): void } = { waitUntil: () => {} },
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

  // Tenant ownership check
  if (tenantId && bill.tenantId !== tenantId) {
    throw new Error(`Bill ${billId} not found`);
  }

  if (bill.status === 'invoiced') {
    throw new Error(`Bill ${billId} is already invoiced`);
  }

  // Fetch tariff to get gstRateBps
  const tariffRows = await db.select().from(tariffConfigs).where(eq(tariffConfigs.id, bill.tariffId)).all();
  const gstRateBps = tariffRows[0]?.gstRateBps ?? 1800;

  // Determine tax type and calculate tax
  const taxType: TaxType = determineTaxType(supplierGSTIN, recipientGSTIN);
  const taxBreakdown = calculateInvoiceTax(bill.subtotalPaisa, taxType, gstRateBps);

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
    eInvoiceStatus: 'pending_irn',
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
    actor: tenantId ?? 'api_token',
    createdAt: nowStr,
  });

  const inserted = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  const invoice = inserted[0];

  // Trigger IRP generation asynchronously if env is configured
  if (env) {
    const tenantRows = await db.select().from(tenants).where(eq(tenants.id, invoice.tenantId)).all();
    const tenant = tenantRows[0];
    if (tenant) {
      ctx.waitUntil(
        triggerIrpGeneration(invoice, bill, tenant, env, db, 'INV', undefined, gstRateBps)
          .catch((err) => console.error('[IRP] async generation failed:', err)),
      );
    }
  }

  return { invoice, invoiceNumber };
}

/**
 * Cancel an invoice. Marks status as 'cancelled' and logs audit.
 * If within 24h window and IRN exists, calls GSP to cancel.
 */
export async function cancelInvoice(
  invoiceId: string,
  reason: string,
  db: Database,
  tenantId: string | null = null,
  env?: Bindings,
): Promise<typeof invoices.$inferSelect> {
  const rows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  if (rows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const invoice = rows[0];

  // Tenant ownership check
  if (tenantId && invoice.tenantId !== tenantId) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  if (invoice.status === 'cancelled') {
    throw new Error(`Invoice ${invoiceId} is already cancelled`);
  }

  const now = new Date();
  const nowStr = now.toISOString();

  const updateFields: Record<string, unknown> = { status: 'cancelled', updatedAt: nowStr };

  // IRP cancellation handling
  if (invoice.irn && invoice.irnGeneratedAt) {
    const withinWindow =
      now.getTime() - new Date(invoice.irnGeneratedAt).getTime() < 24 * 60 * 60 * 1000;

    if (withinWindow && env) {
      await cancelIrn(invoice.irn, mapReasonToCode(reason), buildGspConfig(env));
      updateFields.eInvoiceStatus = 'irn_cancelled';
      updateFields.irnCancelledAt = nowStr;
    } else if (!withinWindow) {
      // Log audit entry for skipped IRP cancellation
      await db.insert(invoiceAuditLog).values({
        id: generateId(),
        invoiceId,
        action: 'irp_cancel_skipped',
        detailsJson: JSON.stringify({ reason: 'IRP cancellation skipped: outside 24h window' }),
        actor: tenantId ?? 'api_token',
        createdAt: nowStr,
      });
    }
  }

  await db
    .update(invoices)
    .set(updateFields as Partial<typeof invoices.$inferInsert>)
    .where(eq(invoices.id, invoiceId));

  // Revert bill status to 'finalized' (available for re-invoicing)
  await db
    .update(bills)
    .set({ status: 'draft', updatedAt: nowStr })
    .where(eq(bills.id, invoice.billId));

  // Audit log
  await db.insert(invoiceAuditLog).values({
    id: generateId(),
    invoiceId,
    action: 'cancelled',
    detailsJson: JSON.stringify({ reason }),
    actor: tenantId ?? 'api_token',
    createdAt: nowStr,
  });

  const updated = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  return updated[0];
}

/**
 * Create a credit note for an invoice.
 * Triggers async IRP generation for the credit note.
 */
export async function createCreditNote(
  invoiceId: string,
  amountPaisa: number,
  reason: string,
  db: Database,
  tenantId: string | null = null,
  env?: Bindings,
  ctx: { waitUntil(p: Promise<unknown>): void } = { waitUntil: () => {} },
): Promise<typeof creditNotes.$inferSelect> {
  // Fetch original invoice
  const invoiceRows = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).all();
  if (invoiceRows.length === 0) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }
  const invoice = invoiceRows[0];

  // Tenant ownership check
  if (tenantId && invoice.tenantId !== tenantId) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

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

  // Fetch bill and tariff for gstRateBps
  const creditNoteBillRows = await db.select().from(bills).where(eq(bills.id, invoice.billId)).all();
  const creditNoteTariffRows = creditNoteBillRows[0]
    ? await db.select().from(tariffConfigs).where(eq(tariffConfigs.id, creditNoteBillRows[0].tariffId)).all()
    : [];
  const creditNoteGstRateBps = creditNoteTariffRows[0]?.gstRateBps ?? 1800;

  // Calculate tax on credit note amount (same tax type as original)
  const taxBreakdown = calculateInvoiceTax(amountPaisa, invoice.taxType as TaxType, creditNoteGstRateBps);

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
    eInvoiceStatus: 'pending_irn',
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
    actor: tenantId ?? 'api_token',
    createdAt: nowStr,
  });

  // Fetch the created credit note (treat as invoice for IRP purposes — uses invoices table for e_invoice_status)
  const inserted = await db.select().from(creditNotes).where(eq(creditNotes.id, creditNoteId)).all();

  // Trigger IRP for credit note asynchronously
  if (env) {
    const tenantRows = await db.select().from(tenants).where(eq(tenants.id, invoice.tenantId)).all();
    if (creditNoteBillRows[0] && tenantRows[0]) {
      ctx.waitUntil(
        triggerIrpGeneration(invoice, creditNoteBillRows[0], tenantRows[0], env, db, 'CRN', invoice, creditNoteGstRateBps)
          .catch((err) => console.error('[IRP] credit note IRP failed:', err)),
      );
    }
  }

  return inserted[0];
}
