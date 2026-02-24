import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers.js';
import { createInvoice, cancelInvoice, createCreditNote } from '../../src/services/invoicing.js';
import { tenants, tariffConfigs, meters, bills, invoices, invoiceAuditLog, invoiceSequences } from '../../src/db/schema.js';
import type { Database } from '../../src/db/client.js';

// Pre-computed valid GSTINs (with correct Luhn mod 36 checksums)
const KA_GSTIN = '29AABCT1332E1ZP'; // Karnataka (state code 29)
const MH_GSTIN = '27AABCT1332E1ZT'; // Maharashtra (state code 27)
const KA_GSTIN2 = '29AADCB2230M1ZP'; // Another KA entity

async function seedBillData(db: Database) {
  const now = new Date().toISOString();

  await (db as any).insert(tenants).values({
    id: 'tenant-1', name: 'Test DC', stateCode: 'KA', createdAt: now, updatedAt: now,
  });

  await (db as any).insert(tariffConfigs).values({
    id: 'ka-ht2a-2025', stateCode: 'KA', discom: 'BESCOM', category: 'HT-2(a)',
    effectiveFrom: '2025-01-01', billingUnit: 'kWh',
    baseEnergyRatePaisa: 660, wheelingChargePaisa: 0,
    demandChargePerKvaPaisa: 35000, demandRatchetPercent: 100, minimumDemandKva: 0,
    timeSlotsJson: '[]', fuelAdjustmentPaisa: 28, fuelAdjustmentType: 'absolute',
    electricityDutyBps: 600, pfThresholdBps: 9000, pfPenaltyRatePaisa: 15,
    version: 1, createdAt: now, updatedAt: now,
  });

  await (db as any).insert(meters).values({
    id: 'meter-001', tenantId: 'tenant-1', name: 'Grid A', stateCode: 'KA',
    tariffId: 'ka-ht2a-2025', createdAt: now, updatedAt: now,
  });

  await (db as any).insert(bills).values({
    id: 'bill-001', tenantId: 'tenant-1', meterId: 'meter-001', tariffId: 'ka-ht2a-2025',
    billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
    peakKwh: 1000, normalKwh: 2000, offPeakKwh: 500, totalKwh: 3500,
    billedKvah: null, contractedDemandKva: 400, recordedDemandKva: 380,
    billedDemandKva: 400, powerFactor: 9500,
    peakChargesPaisa: 660000, normalChargesPaisa: 1320000, offPeakChargesPaisa: 330000,
    totalEnergyChargesPaisa: 2310000, wheelingChargesPaisa: 0,
    demandChargesPaisa: 14000000, fuelAdjustmentPaisa: 98000,
    electricityDutyPaisa: 984480, pfPenaltyPaisa: 0, dgChargesPaisa: 0,
    subtotalPaisa: 17392480, gstPaisa: 3130646,
    totalBillPaisa: 20523126, effectiveRatePaisaPerKwh: 586,
    status: 'draft', createdAt: now, updatedAt: now,
  });

  // Second bill for multiple invoice tests
  await (db as any).insert(bills).values({
    id: 'bill-002', tenantId: 'tenant-1', meterId: 'meter-001', tariffId: 'ka-ht2a-2025',
    billingPeriodStart: '2026-02-01', billingPeriodEnd: '2026-02-28',
    peakKwh: 800, normalKwh: 1600, offPeakKwh: 400, totalKwh: 2800,
    billedKvah: null, contractedDemandKva: 400, recordedDemandKva: 350,
    billedDemandKva: 400, powerFactor: 9500,
    peakChargesPaisa: 528000, normalChargesPaisa: 1056000, offPeakChargesPaisa: 264000,
    totalEnergyChargesPaisa: 1848000, wheelingChargesPaisa: 0,
    demandChargesPaisa: 14000000, fuelAdjustmentPaisa: 78400,
    electricityDutyPaisa: 955584, pfPenaltyPaisa: 0, dgChargesPaisa: 0,
    subtotalPaisa: 16881984, gstPaisa: 3038757,
    totalBillPaisa: 19920741, effectiveRatePaisaPerKwh: 712,
    status: 'draft', createdAt: now, updatedAt: now,
  });
}

describe('Invoice Service', () => {
  let db: Database;

  beforeEach(async () => {
    const testDb = await createTestDb();
    db = testDb.db as unknown as Database;
    await seedBillData(db);
  });

  // INV-A01: Create audit — record with action='created'
  it('INV-A01: createInvoice writes audit log with action=created', async () => {
    const { invoice } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);

    const auditRows = await (db as any)
      .select()
      .from(invoiceAuditLog)
      .where(eq(invoiceAuditLog.invoiceId, invoice.id))
      .all();

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].action).toBe('created');
    expect(JSON.parse(auditRows[0].detailsJson)).toHaveProperty('billId', 'bill-001');
  });

  // INV-A02: Finalize audit — status changes tracked
  it('INV-A02: invoice status transitions are recorded', async () => {
    const { invoice } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);
    expect(invoice.status).toBe('draft');

    // Cancel the invoice (tracks status change)
    const cancelled = await cancelInvoice(invoice.id, 'Wrong billing period', db);
    expect(cancelled.status).toBe('cancelled');

    const auditRows = await (db as any)
      .select()
      .from(invoiceAuditLog)
      .where(eq(invoiceAuditLog.invoiceId, invoice.id))
      .all();

    expect(auditRows).toHaveLength(2);
    expect(auditRows.map((r: any) => r.action)).toContain('created');
    expect(auditRows.map((r: any) => r.action)).toContain('cancelled');
  });

  // INV-A03: Cancel audit — reason recorded
  it('INV-A03: cancel audit records reason', async () => {
    const { invoice } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);
    await cancelInvoice(invoice.id, 'Duplicate invoice', db);

    const auditRows = await (db as any)
      .select()
      .from(invoiceAuditLog)
      .where(eq(invoiceAuditLog.invoiceId, invoice.id))
      .all();

    const cancelAudit = auditRows.find((r: any) => r.action === 'cancelled');
    expect(cancelAudit).toBeDefined();
    expect(JSON.parse(cancelAudit.detailsJson).reason).toBe('Duplicate invoice');
  });

  // INV-A04: Credit note link — links to original invoice
  it('INV-A04: credit note audit links to original invoice', async () => {
    const { invoice } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);

    const creditNote = await createCreditNote(
      invoice.id,
      1000000, // ₹10,000
      'Billing error correction',
      db,
    );

    expect(creditNote.invoiceId).toBe(invoice.id);

    const auditRows = await (db as any)
      .select()
      .from(invoiceAuditLog)
      .where(eq(invoiceAuditLog.invoiceId, invoice.id))
      .all();

    const cnAudit = auditRows.find((r: any) => r.action === 'credit_note_issued');
    expect(cnAudit).toBeDefined();
    const details = JSON.parse(cnAudit.detailsJson);
    expect(details.creditNoteId).toBe(creditNote.id);
    expect(details.amountPaisa).toBe(1000000);
  });

  // INV-A05: Immutability — cannot create invoice for already-invoiced bill
  it('INV-A05: cannot re-invoice an already invoiced bill', async () => {
    await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);

    await expect(
      createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db),
    ).rejects.toThrow('already invoiced');
  });

  // INV-N04: 10 sequential creates all unique
  it('INV-N04: sequential invoice creates produce unique numbers', async () => {
    // We need 10 bills. We have 2, seed 8 more.
    const now = new Date().toISOString();
    for (let i = 3; i <= 10; i++) {
      await (db as any).insert(bills).values({
        id: `bill-${String(i).padStart(3, '0')}`, tenantId: 'tenant-1', meterId: 'meter-001',
        tariffId: 'ka-ht2a-2025', billingPeriodStart: '2026-01-01', billingPeriodEnd: '2026-01-31',
        peakKwh: 100, normalKwh: 200, offPeakKwh: 50, totalKwh: 350,
        billedKvah: null, contractedDemandKva: 100, recordedDemandKva: 90,
        billedDemandKva: 100, powerFactor: 9500,
        peakChargesPaisa: 66000, normalChargesPaisa: 132000, offPeakChargesPaisa: 33000,
        totalEnergyChargesPaisa: 231000, wheelingChargesPaisa: 0,
        demandChargesPaisa: 3500000, fuelAdjustmentPaisa: 9800,
        electricityDutyPaisa: 224448, pfPenaltyPaisa: 0, dgChargesPaisa: 0,
        subtotalPaisa: 3965248, gstPaisa: 713745,
        totalBillPaisa: 4678993, effectiveRatePaisaPerKwh: 1337,
        status: 'draft', createdAt: now, updatedAt: now,
      });
    }

    const invoiceNumbers: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const billId = `bill-${String(i).padStart(3, '0')}`;
      const { invoiceNumber } = await createInvoice(billId, KA_GSTIN, KA_GSTIN2, db);
      invoiceNumbers.push(invoiceNumber);
    }

    const unique = new Set(invoiceNumbers);
    expect(unique.size).toBe(10);

    // Verify sequential
    for (let i = 0; i < invoiceNumbers.length; i++) {
      expect(invoiceNumbers[i]).toContain(String(i + 1).padStart(6, '0'));
    }
  });

  // INV-N06: After cancel, next still increments
  it('INV-N06: after cancel, next invoice still increments', async () => {
    const { invoice: inv1, invoiceNumber: num1 } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);
    await cancelInvoice(inv1.id, 'Test cancel', db);

    // bill-001 status reverted to draft, can re-invoice
    const { invoiceNumber: num2 } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);

    // num2 should have sequence 2, not 1
    expect(num1).not.toBe(num2);
    expect(num2).toContain('000002');
  });

  it('intra-state invoice has CGST+SGST, inter-state has IGST', async () => {
    // Intra-state (KA→KA)
    const { invoice: intraInv } = await createInvoice('bill-001', KA_GSTIN, KA_GSTIN2, db);
    expect(intraInv.taxType).toBe('CGST_SGST');
    expect(intraInv.cgstPaisa).toBeGreaterThan(0);
    expect(intraInv.sgstPaisa).toBeGreaterThan(0);
    expect(intraInv.igstPaisa).toBe(0);

    // Inter-state (KA→MH)
    const { invoice: interInv } = await createInvoice('bill-002', KA_GSTIN, MH_GSTIN, db);
    expect(interInv.taxType).toBe('IGST');
    expect(interInv.cgstPaisa).toBe(0);
    expect(interInv.sgstPaisa).toBe(0);
    expect(interInv.igstPaisa).toBeGreaterThan(0);
  });
});
