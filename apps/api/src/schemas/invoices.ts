import { z } from 'zod';

const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const CreateInvoiceSchema = z.object({
  billId: z.string().min(1),
  supplierGSTIN: z.string().regex(gstinRegex, 'Invalid GSTIN format (e.g., 29ABCDE1234F1Z5)'),
  recipientGSTIN: z.string().regex(gstinRegex, 'Invalid GSTIN format (e.g., 29ABCDE1234F1Z5)'),
});

export const CancelInvoiceSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const CreateCreditNoteSchema = z.object({
  invoiceId: z.string().min(1),
  amountPaisa: z.number().int().positive(),
  reason: z.string().min(1).max(1000),
});
