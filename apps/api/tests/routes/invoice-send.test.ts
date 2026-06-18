import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDb, createAppWithTenant, createCollectingCtx } from '../helpers.js';
import { invoicesRouter } from '../../src/routes/invoices.js';
import {
  tenants, tariffConfigs, meters, bills, invoices,
} from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

describe('POST /invoices/:id/send', () => {
  let db: Database;
  const MOCK_ENV = {
    RESEND_API_KEY: 'test-key',
    PLATFORM_GSTIN: '27ABCDE1234F1Z5',
    PLATFORM_LEGAL_NAME: 'BharatDCIM Pvt Ltd',
    PLATFORM_ADDRESS1: '123 BKC',
    PLATFORM_CITY: 'Mumbai',
    PLATFORM_PINCODE: '400051',
  } as any;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"id":"email-1"}', { status: 200 })));

    const now = '2026-06-18T00:00:00Z';
    await (db as any).insert(tenants).values({
      id: 'tenant-1', name: 'Acme DC', stateCode: 'MH',
      billingEmail: 'billing@acme.com',
      createdAt: now, updatedAt: now,
    });
    await (db as any).insert(tariffConfigs).values({
      id: 'tariff-1', stateCode: 'MH', discom: 'MSEDCL', category: 'HT', effectiveFrom: '2026-01-01',
      billingUnit: 'kWh', baseEnergyRatePaisa: 500, wheelingChargePaisa: 50, demandChargePerKvaPaisa: 100,
      demandRatchetPercent: 0, minimumDemandKva: 0, timeSlotsJson: '[]',
      fuelAdjustmentPaisa: 0, fuelAdjustmentType: 'per_unit',
      electricityDutyBps: 0, pfThresholdBps: 0, pfPenaltyRatePaisa: 0,
      gstRateBps: 1800, version: 1,
      createdAt: now, updatedAt: now,
    });
    await (db as any).insert(meters).values({ id: 'meter-1', tenantId: 'tenant-1', name: 'Test Meter', stateCode: 'MH', createdAt: now, updatedAt: now });
    await (db as any).insert(bills).values({
      id: 'bill-1', tenantId: 'tenant-1', meterId: 'meter-1', tariffId: 'tariff-1',
      billingPeriodStart: '2026-05-01', billingPeriodEnd: '2026-05-31',
      peakKwh: 0, normalKwh: 0, offPeakKwh: 0, totalKwh: 1000,
      contractedDemandKva: 0, recordedDemandKva: 0, billedDemandKva: 0,
      powerFactor: 9000,
      peakChargesPaisa: 0, normalChargesPaisa: 0, offPeakChargesPaisa: 0,
      totalEnergyChargesPaisa: 0, wheelingChargesPaisa: 0, demandChargesPaisa: 0,
      fuelAdjustmentPaisa: 0, electricityDutyPaisa: 0, pfPenaltyPaisa: 0,
      dgChargesPaisa: 0, subtotalPaisa: 1000000, gstPaisa: 180000, totalBillPaisa: 1180000,
      effectiveRatePaisaPerKwh: 1000,
      status: 'draft', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(invoices).values({
      id: 'inv-1', billId: 'bill-1', tenantId: 'tenant-1',
      invoiceNumber: 'INV/2526/001', financialYear: '2526',
      supplierGstin: '27ABCDE1234F1Z5', recipientGstin: '27ABCDE1234F1Z5',
      taxType: 'CGST_SGST', taxableAmountPaisa: 1000000,
      cgstPaisa: 90000, sgstPaisa: 90000, totalTaxPaisa: 180000, totalAmountPaisa: 1180000,
      status: 'draft', eInvoiceStatus: 'irn_generated',
      irn: 'testirn123', ackNo: 'ack001', ackDt: now,
      recipientEmail: 'customer@example.com',
      invoiceDate: now, createdAt: now, updatedAt: now,
    });
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  function makeApp() {
    const { ctx } = createCollectingCtx();
    const app = createAppWithTenant(db, 'tenant-1', { irpCtx: ctx });
    app.route('/invoices', invoicesRouter);
    return app;
  }

  it('sends PDF email to invoice recipientEmail and returns { sent: true }', async () => {
    const app = makeApp();
    const res = await app.request('/invoices/inv-1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, MOCK_ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(body.to).toBe('customer@example.com');
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const reqBody = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as any).body);
    expect(reqBody.attachments).toHaveLength(1);
    expect(reqBody.attachments[0].filename).toBe('INV/2526/001.pdf');
    expect(reqBody.attachments[0].content_type).toBe('application/pdf');
  });

  it('overrides recipient when to is provided in body', async () => {
    const app = makeApp();
    const res = await app.request('/invoices/inv-1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'override@example.com' }),
    }, MOCK_ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.to).toBe('override@example.com');
  });

  it('returns 400 when no recipient is resolvable', async () => {
    // Remove recipientEmail from invoice and billingEmail from tenant
    await (db as any).update(invoices).set({ recipientEmail: null }).where(
      (db as any).eq ? undefined : undefined // drizzle update
    );
    // Create invoice without recipient email and tenant without billing email
    const now = '2026-06-18T00:00:00Z';
    await (db as any).insert(tenants).values({
      id: 'tenant-2', name: 'No Email DC', stateCode: 'MH',
      createdAt: now, updatedAt: now,
    });
    await (db as any).insert(bills).values({
      id: 'bill-2', tenantId: 'tenant-2', meterId: 'meter-1', tariffId: 'tariff-1',
      billingPeriodStart: '2026-05-01', billingPeriodEnd: '2026-05-31',
      peakKwh: 0, normalKwh: 0, offPeakKwh: 0, totalKwh: 500,
      contractedDemandKva: 0, recordedDemandKva: 0, billedDemandKva: 0,
      powerFactor: 9000,
      peakChargesPaisa: 0, normalChargesPaisa: 0, offPeakChargesPaisa: 0,
      totalEnergyChargesPaisa: 0, wheelingChargesPaisa: 0, demandChargesPaisa: 0,
      fuelAdjustmentPaisa: 0, electricityDutyPaisa: 0, pfPenaltyPaisa: 0,
      dgChargesPaisa: 0, subtotalPaisa: 500000, gstPaisa: 90000, totalBillPaisa: 590000,
      effectiveRatePaisaPerKwh: 1000,
      status: 'draft', createdAt: now, updatedAt: now,
    });
    await (db as any).insert(invoices).values({
      id: 'inv-2', billId: 'bill-2', tenantId: 'tenant-2',
      invoiceNumber: 'INV/2526/002', financialYear: '2526',
      supplierGstin: '27ABCDE1234F1Z5', recipientGstin: '27ABCDE1234F1Z5',
      taxType: 'CGST_SGST', taxableAmountPaisa: 500000,
      cgstPaisa: 45000, sgstPaisa: 45000, totalTaxPaisa: 90000, totalAmountPaisa: 590000,
      status: 'draft', eInvoiceStatus: 'pending_irn',
      invoiceDate: now, createdAt: now, updatedAt: now,
    });

    const { ctx } = createCollectingCtx();
    const app = createAppWithTenant(db, 'tenant-2', { irpCtx: ctx });
    app.route('/invoices', invoicesRouter);

    const res = await app.request('/invoices/inv-2/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, MOCK_ENV);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});
