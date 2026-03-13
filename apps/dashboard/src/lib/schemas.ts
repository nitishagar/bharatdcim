import { z } from 'zod';

const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const calculateBillSchema = z.object({
  meterId: z.string().min(1, 'Select a meter'),
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  peakKwh: z.string(),
  normalKwh: z.string(),
  offPeakKwh: z.string(),
  contractedDemandKva: z.string(),
  recordedDemandKva: z.string(),
  powerFactor: z.string(),
});

export type CalculateBillForm = z.infer<typeof calculateBillSchema>;

export const createInvoiceSchema = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  supplierGSTIN: z.string().regex(gstinRegex, 'Invalid GSTIN format (e.g., 29ABCDE1234F1Z5)'),
  recipientGSTIN: z.string().regex(gstinRegex, 'Invalid GSTIN format (e.g., 29ABCDE1234F1Z5)'),
});

export type CreateInvoiceForm = z.infer<typeof createInvoiceSchema>;

export const cancelInvoiceSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export type CancelInvoiceForm = z.infer<typeof cancelInvoiceSchema>;

export const creditNoteSchema = z.object({
  amount: z.string().min(1, 'Amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be a positive number'),
  reason: z.string().min(1, 'Reason is required'),
});

export type CreditNoteForm = z.infer<typeof creditNoteSchema>;

export const createMeterSchema = z.object({
  name: z.string().min(1, 'Meter name is required'),
  stateCode: z.string().min(1, 'State code is required'),
  siteId: z.string().optional(),
  tariffId: z.string().optional(),
  meterType: z.enum(['grid', 'dg', 'solar']).optional(),
});

export type CreateMeterForm = z.infer<typeof createMeterSchema>;

export const createTenantSchema = z.object({
  name: z.string().min(1, 'Tenant name is required'),
  stateCode: z.string().min(1, 'State code is required'),
  gstin: z.string().optional().refine(
    (v) => !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v),
    'Invalid GSTIN format (e.g., 29ABCDE1234F1Z5)',
  ),
  billingAddress: z.string().optional(),
});

export type CreateTenantForm = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = createTenantSchema;
export type UpdateTenantForm = CreateTenantForm;

export const createTariffSchema = z.object({
  stateCode: z.string().min(1, 'State code is required'),
  discom: z.string().min(1, 'DISCOM is required'),
  category: z.string().min(1, 'Category is required'),
  baseEnergyRatePaisa: z.string().min(1, 'Base energy rate is required')
    .refine((v) => !isNaN(parseInt(v)) && parseInt(v) > 0, 'Must be a positive integer (paisa)'),
  wheelingChargePaisa: z.string().optional(),
  demandChargePerKvaPaisa: z.string().optional(),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional(),
  billingUnit: z.enum(['kWh', 'kVAh']).optional(),
});

export type CreateTariffForm = z.infer<typeof createTariffSchema>;

export const editMeterSchema = createMeterSchema.partial();
export type EditMeterForm = z.infer<typeof editMeterSchema>;

export const editTariffSchema = createTariffSchema.partial();
export type EditTariffForm = z.infer<typeof editTariffSchema>;
