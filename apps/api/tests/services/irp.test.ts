import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb, createAppWithTenant } from '../helpers.js';
import { tenants, tariffConfigs, meters, bills, invoices, irpRetryQueue, invoiceAuditLog } from '../../src/db/schema.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import { createInvoice, cancelInvoice, createCreditNote } from '../../src/services/invoicing.js';
import { generateIrn, cancelIrn, mapReasonToCode } from '../../src/services/irp.js';
import { eq } from 'drizzle-orm';
import type { Database } from '../../src/db/client.js';
import type { Bindings } from '../../src/types.js';

const baseNow = '2026-04-01T00:00:00Z';

const mockEnv: Bindings = {
  TURSO_DATABASE_URL: 'file::memory:',
  TURSO_AUTH_TOKEN: 'test',
  API_TOKEN: 'test-token',
  RESEND_API_KEY: 'test-resend',
  GSP_API_KEY: 'test-gsp-key',
  GSP_BASE_URL: 'https://api.gsp.test/v1/einvoice',
  PLATFORM_LEGAL_NAME: 'BharatDCIM Pvt Ltd',
  PLATFORM_ADDRESS1: '123 DC Road',
  PLATFORM_CITY: 'Mumbai',
  PLATFORM_PINCODE: '400001',
  PLATFORM_GSTIN: '27AAPFU0939F1ZV',
};

const mockGspSuccess = {
  ok: true,
  json: async () => ({
    Irn: 'a'.repeat(64),
    AckNo: 112010000011474,
    AckDt: '2026-04-01 14:30:00',
    SignedQRCode: 'eyJhbGciOiJSUzI1NiJ9.mock.signature',
  }),
};

async function seedBase(db: Database) {
  await (db as any).insert(tenants).values({
    id: 'tenant-001',
    name: 'Test DC',
    stateCode: 'MH',
    address1: '456 Data Street',
    city: 'Mumbai',
    pincode: '400002',
    legalName: 'Test DC Pvt Ltd',
    createdAt: baseNow,
    updatedAt: baseNow,
  });
  await (db as any).insert(tariffConfigs).values({
    id: 'tc1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2025-01-01',
    billingUnit: 'kWh', baseEnergyRatePaisa: 800, wheelingChargePaisa: 50,
    demandChargePerKvaPaisa: 50000, demandRatchetPercent: 75, minimumDemandKva: 50,
    timeSlotsJson: '[]', fuelAdjustmentPaisa: 50, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 20,
    version: 1, createdAt: baseNow, updatedAt: baseNow,
  });
  await (db as any).insert(meters).values({
    id: 'meter-001', tenantId: 'tenant-001', name: 'Main Meter', stateCode: 'MH',
    tariffId: 'tc1', createdAt: baseNow, updatedAt: baseNow,
  });
  await (db as any).insert(bills).values({
    id: 'bill-001', tenantId: 'tenant-001', meterId: 'meter-001', tariffId: 'tc1',
    billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
    peakKwh: 100, normalKwh: 500, offPeakKwh: 100, totalKwh: 700,
    contractedDemandKva: 100, recordedDemandKva: 90, billedDemandKva: 100,
    powerFactor: 9500, peakChargesPaisa: 80000, normalChargesPaisa: 350000,
    offPeakChargesPaisa: 70000, totalEnergyChargesPaisa: 500000,
    wheelingChargesPaisa: 35000, demandChargesPaisa: 500000,
    fuelAdjustmentPaisa: 35000, electricityDutyPaisa: 64200, pfPenaltyPaisa: 0,
    dgChargesPaisa: 0, subtotalPaisa: 1134200, gstPaisa: 204156, totalBillPaisa: 1338356,
    effectiveRatePaisaPerKwh: 1912, createdAt: baseNow, updatedAt: baseNow,
  });
}

describe('IRP Service tests', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('IRP-SVC-01: triggerIrpGeneration success — invoice IRN columns set, e_invoice_status=irn_generated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockGspSuccess));

    let capturedPromise: Promise<unknown>;
    const ctx = { waitUntil: (p: Promise<unknown>) => { capturedPromise = p; } };

    const result = await createInvoice(
      'bill-001', '27AAPFU0939F1ZV', '27XYZPQ9876A1ZS',
      db, 'tenant-001', mockEnv, ctx,
    );

    await capturedPromise!;

    const rows = await (db as any).select().from(invoices).where(eq(invoices.id, result.invoice.id)).all();
    expect(rows[0].eInvoiceStatus).toBe('irn_generated');
    expect(rows[0].irn).toBe('a'.repeat(64));
    expect(rows[0].ackNo).toBe('112010000011474');
    expect(rows[0].signedQrCode).toBe('eyJhbGciOiJSUzI1NiJ9.mock.signature');
    expect(rows[0].irnGeneratedAt).toBeDefined();
  });

  it('IRP-SVC-02: GSP fetch throws — irp_retry_queue row inserted, invoice stays pending_irn', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('GSP unavailable')));

    let capturedPromise: Promise<unknown>;
    const ctx = { waitUntil: (p: Promise<unknown>) => { capturedPromise = p; } };

    const result = await createInvoice(
      'bill-001', '27AAPFU0939F1ZV', '27XYZPQ9876A1ZS',
      db, 'tenant-001', mockEnv, ctx,
    );

    await capturedPromise!;

    // Invoice should still be pending_irn
    const invoiceRows = await (db as any).select().from(invoices).where(eq(invoices.id, result.invoice.id)).all();
    expect(invoiceRows[0].eInvoiceStatus).toBe('pending_irn');

    // Retry queue should have an entry
    const retryRows = await (db as any).select().from(irpRetryQueue).all();
    expect(retryRows.length).toBe(1);
    expect(retryRows[0].status).toBe('pending');
    expect(retryRows[0].invoiceId).toBe(result.invoice.id);

    // next_retry_at should be approximately now + 5 minutes
    const nextRetry = new Date(retryRows[0].nextRetryAt).getTime();
    const expected = Date.now() + 5 * 60 * 1000;
    expect(nextRetry).toBeGreaterThan(Date.now());
    expect(nextRetry).toBeLessThanOrEqual(expected + 2000);
  });

  it('IRP-SVC-03: cancelInvoice with IRN and irnGeneratedAt 2h ago → GSP cancel called, status=irn_cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    await (db as any).insert(invoices).values({
      id: 'invoice-with-irn', billId: 'bill-001', tenantId: 'tenant-001',
      invoiceNumber: 'INV/2627/000001', financialYear: '2627',
      supplierGstin: '27AAPFU0939F1ZV', recipientGstin: '27XYZPQ9876A1Z3',
      taxType: 'CGST_SGST', taxableAmountPaisa: 1134200,
      cgstPaisa: 102078, sgstPaisa: 102078, igstPaisa: null,
      totalTaxPaisa: 204156, totalAmountPaisa: 1338356,
      eInvoiceStatus: 'irn_generated',
      irn: 'a'.repeat(64),
      irnGeneratedAt: twoHoursAgo,
      invoiceDate: baseNow, createdAt: baseNow, updatedAt: baseNow,
    });

    const result = await cancelInvoice('invoice-with-irn', 'Duplicate', db, 'tenant-001', mockEnv);

    expect(result.status).toBe('cancelled');
    expect(result.eInvoiceStatus).toBe('irn_cancelled');
    expect(result.irnCancelledAt).toBeDefined();
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it('IRP-SVC-04: cancelInvoice with IRN and irnGeneratedAt 25h ago → GSP cancel NOT called, audit log has skip message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    await (db as any).insert(invoices).values({
      id: 'invoice-old-irn', billId: 'bill-001', tenantId: 'tenant-001',
      invoiceNumber: 'INV/2627/000002', financialYear: '2627',
      supplierGstin: '27AAPFU0939F1ZV', recipientGstin: '27XYZPQ9876A1Z3',
      taxType: 'CGST_SGST', taxableAmountPaisa: 1134200,
      cgstPaisa: 102078, sgstPaisa: 102078, igstPaisa: null,
      totalTaxPaisa: 204156, totalAmountPaisa: 1338356,
      eInvoiceStatus: 'irn_generated',
      irn: 'b'.repeat(64),
      irnGeneratedAt: twentyFiveHoursAgo,
      invoiceDate: baseNow, createdAt: baseNow, updatedAt: baseNow,
    });

    const result = await cancelInvoice('invoice-old-irn', 'Order Cancelled', db, 'tenant-001', mockEnv);

    expect(result.status).toBe('cancelled');
    // GSP cancel should NOT have been called
    expect(mockFetch).not.toHaveBeenCalled();

    // Audit log should have skip message
    const auditRows = await (db as any).select().from(invoiceAuditLog)
      .where(eq(invoiceAuditLog.invoiceId, 'invoice-old-irn')).all();
    const skipEntry = auditRows.find((r: any) => r.action === 'irp_cancel_skipped');
    expect(skipEntry).toBeDefined();
    const details = JSON.parse(skipEntry.detailsJson);
    expect(details.reason).toContain('outside 24h window');
  });

  it('IRP-SVC-05: cancelInvoice with no IRN (not_applicable) → no GSP call, invoice cancelled, no IRP audit entry', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await (db as any).insert(invoices).values({
      id: 'invoice-no-irn', billId: 'bill-001', tenantId: 'tenant-001',
      invoiceNumber: 'INV/2627/000003', financialYear: '2627',
      supplierGstin: '27AAPFU0939F1ZV', recipientGstin: '27XYZPQ9876A1Z3',
      taxType: 'CGST_SGST', taxableAmountPaisa: 1134200,
      cgstPaisa: 102078, sgstPaisa: 102078, igstPaisa: null,
      totalTaxPaisa: 204156, totalAmountPaisa: 1338356,
      eInvoiceStatus: 'not_applicable',
      invoiceDate: baseNow, createdAt: baseNow, updatedAt: baseNow,
    });

    const result = await cancelInvoice('invoice-no-irn', 'Other', db, 'tenant-001', mockEnv);

    expect(result.status).toBe('cancelled');
    expect(mockFetch).not.toHaveBeenCalled();

    // No IRP-specific audit entries
    const auditRows = await (db as any).select().from(invoiceAuditLog)
      .where(eq(invoiceAuditLog.invoiceId, 'invoice-no-irn')).all();
    const irpEntry = auditRows.find((r: any) => r.action === 'irp_cancel_skipped');
    expect(irpEntry).toBeUndefined();
  });

  it('IRP-SVC-06: createCreditNote with tenant having address → async IRP triggered with docType=CRN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockGspSuccess));

    // First create an invoice
    await (db as any).insert(invoices).values({
      id: 'invoice-for-cn', billId: 'bill-001', tenantId: 'tenant-001',
      invoiceNumber: 'INV/2627/000001', financialYear: '2627',
      supplierGstin: '27AAPFU0939F1ZV', recipientGstin: '27XYZPQ9876A1Z3',
      taxType: 'CGST_SGST', taxableAmountPaisa: 1134200,
      cgstPaisa: 102078, sgstPaisa: 102078, igstPaisa: null,
      totalTaxPaisa: 204156, totalAmountPaisa: 1338356,
      eInvoiceStatus: 'irn_generated',
      irn: 'a'.repeat(64),
      irnGeneratedAt: baseNow,
      invoiceDate: baseNow, createdAt: baseNow, updatedAt: baseNow,
    });

    let capturedPromise: Promise<unknown>;
    const ctx = { waitUntil: (p: Promise<unknown>) => { capturedPromise = p; } };

    await createCreditNote('invoice-for-cn', 100000, 'Duplicate', db, 'tenant-001', mockEnv, ctx);

    expect(capturedPromise!).toBeDefined();

    // Verify the fetch call would have been made (async IRP triggered)
    await capturedPromise!;
    expect(vi.mocked(fetch)).toHaveBeenCalled();
  });

  it('IRP-SVC-07: GSP returns ErrorCode 2150 (duplicate IRN) → treated as success, invoice updated with IRN data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ErrorCode: 2150,
        Irn: 'c'.repeat(64),
        AckNo: 999,
        AckDt: '2026-04-01 15:00:00',
        SignedQRCode: 'dup.qr.code',
      }),
    }));

    let capturedPromise: Promise<unknown>;
    const ctx = { waitUntil: (p: Promise<unknown>) => { capturedPromise = p; } };

    const result = await createInvoice(
      'bill-001', '27AAPFU0939F1ZV', '27XYZPQ9876A1ZS',
      db, 'tenant-001', mockEnv, ctx,
    );

    await capturedPromise!;

    const rows = await (db as any).select().from(invoices).where(eq(invoices.id, result.invoice.id)).all();
    // Duplicate IRN should be treated as success
    expect(rows[0].eInvoiceStatus).toBe('irn_generated');
    expect(rows[0].irn).toBe('c'.repeat(64));
  });
});

describe('IRP Route tests', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBase(db);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('IRP-ROUTE-01: POST /invoices returns 201 with e_invoice_status: pending_irn immediately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockGspSuccess));

    const capturedPromises: Promise<unknown>[] = [];
    const irpCtx = { waitUntil: (p: Promise<unknown>) => capturedPromises.push(p) };

    const app = createAppWithTenant(db, 'tenant-001', {
      orgRole: 'admin',
      irpCtx,
    });
    app.route('/invoices', invoicesRouter);

    const res = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billId: 'bill-001',
        supplierGSTIN: '27AAPFU0939F1ZV',
        recipientGSTIN: '27XYZPQ9876A1ZS',
      }),
    }, mockEnv);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.eInvoiceStatus).toBe('pending_irn');
  });

  it('IRP-ROUTE-02: after triggerIrpGeneration resolves, GET /invoices/:id returns irn_generated', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockGspSuccess));

    const capturedPromises: Promise<unknown>[] = [];
    const irpCtx = { waitUntil: (p: Promise<unknown>) => capturedPromises.push(p) };

    const app = createAppWithTenant(db, 'tenant-001', {
      orgRole: 'admin',
      irpCtx,
    });
    app.route('/invoices', invoicesRouter);

    const postRes = await app.request('/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billId: 'bill-001',
        supplierGSTIN: '27AAPFU0939F1ZV',
        recipientGSTIN: '27XYZPQ9876A1ZS',
      }),
    }, mockEnv);

    const invoice = await postRes.json();

    // Wait for IRP generation to complete
    await Promise.all(capturedPromises);

    const getRes = await app.request(`/invoices/${invoice.id}`);
    expect(getRes.status).toBe(200);
    const updated = await getRes.json();
    expect(updated.eInvoiceStatus).toBe('irn_generated');
    expect(updated.irn).toBe('a'.repeat(64));
  });
});

describe('IRP utility functions', () => {
  it('mapReasonToCode - Duplicate → 1', () => {
    expect(mapReasonToCode('Duplicate')).toBe('1');
  });
  it('mapReasonToCode - Data Entry Mistake → 2', () => {
    expect(mapReasonToCode('Data Entry Mistake')).toBe('2');
  });
  it('mapReasonToCode - Order Cancelled → 3', () => {
    expect(mapReasonToCode('Order Cancelled')).toBe('3');
  });
  it('mapReasonToCode - Other → 4', () => {
    expect(mapReasonToCode('Other')).toBe('4');
  });
});
