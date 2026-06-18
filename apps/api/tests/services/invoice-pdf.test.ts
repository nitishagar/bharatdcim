import { describe, it, expect } from 'vitest';
import { renderInvoicePdf } from '../../src/services/invoice-pdf.js';

const MOCK_ENV = {
  PLATFORM_GSTIN: '27ABCDE1234F1Z5',
  PLATFORM_LEGAL_NAME: 'BharatDCIM Pvt Ltd',
  PLATFORM_ADDRESS1: '123 BKC',
  PLATFORM_CITY: 'Mumbai',
  PLATFORM_PINCODE: '400051',
} as any;

const SAMPLE_INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV/2526/001',
  financialYear: '2526',
  supplierGstin: '27ABCDE1234F1Z5',
  recipientGstin: '29FGHIJ5678K1Z3',
  taxType: 'CGST_SGST',
  taxableAmountPaisa: 1000000,
  cgstPaisa: 90000,
  sgstPaisa: 90000,
  igstPaisa: null,
  totalTaxPaisa: 180000,
  totalAmountPaisa: 1180000,
  status: 'draft',
  eInvoiceStatus: 'irn_generated',
  irn: 'abc123irn',
  ackNo: 'ack001',
  ackDt: '2026-06-18T00:00:00Z',
  signedQrCode: null,
  irnGeneratedAt: '2026-06-18T00:00:00Z',
  irnCancelledAt: null,
  recipientEmail: 'customer@example.com',
  invoiceDate: '2026-06-18T00:00:00Z',
  billId: 'bill-1',
  tenantId: 'tenant-1',
  createdAt: '2026-06-18T00:00:00Z',
  updatedAt: '2026-06-18T00:00:00Z',
} as any;

const SAMPLE_TENANT = {
  id: 'tenant-1',
  name: 'Acme DC',
  legalName: 'Acme Data Centre Pvt Ltd',
  gstin: '29FGHIJ5678K1Z3',
  address1: '456 IT Park',
  city: 'Bengaluru',
  pincode: '560001',
  billingEmail: 'billing@acme.com',
  stateCode: 'KA',
  billingAddress: null,
  pincode2: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as any;

describe('renderInvoicePdf', () => {
  it('returns a non-empty Uint8Array starting with %PDF magic bytes', async () => {
    const pdf = await renderInvoicePdf(SAMPLE_INVOICE, SAMPLE_TENANT, MOCK_ENV);
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(100);
    // %PDF magic bytes
    const magic = String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3]);
    expect(magic).toBe('%PDF');
  });

  it('renders IGST invoice without throwing', async () => {
    const igstInvoice = { ...SAMPLE_INVOICE, taxType: 'IGST', cgstPaisa: null, sgstPaisa: null, igstPaisa: 180000, irn: null, signedQrCode: null };
    const pdf = await renderInvoicePdf(igstInvoice, SAMPLE_TENANT, MOCK_ENV);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it('skips QR embed gracefully when signedQrCode is null', async () => {
    const inv = { ...SAMPLE_INVOICE, signedQrCode: null };
    const pdf = await renderInvoicePdf(inv, SAMPLE_TENANT, MOCK_ENV);
    expect(pdf.length).toBeGreaterThan(100);
  });
});
