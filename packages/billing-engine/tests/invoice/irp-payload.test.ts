import { describe, it, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { buildIrpPayload, buildIrpItemList } from '../../src/invoice/irp-payload.js';

const BASE_SELLER = { lglNm: 'BharatDCIM Pvt Ltd', addr1: '123 Server Farm Road', loc: 'Mumbai', pin: 400001 };
const BASE_BUYER = { lglNm: 'DataCenter Corp', addr1: '456 Data Street', loc: 'Bangalore', pin: 560001 };

const INTRA_STATE_PARAMS = {
  invoiceNumber: 'INV/2627/000001',
  invoiceDate: '2026-04-01T00:00:00.000Z',
  docType: 'INV' as const,
  supplierGstin: '27AAPFU0939F1ZV', // Maharashtra (27)
  recipientGstin: '27XYZPQ9876A1Z3', // Maharashtra (27)
  taxType: 'CGST_SGST' as const,
  taxableAmountPaisa: 1000000,
  cgstPaisa: 90000,
  sgstPaisa: 90000,
  igstPaisa: null,
  totalAmountPaisa: 1180000,
  totalKwh: 1000,
  seller: BASE_SELLER,
  buyer: BASE_BUYER,
};

const INTER_STATE_PARAMS = {
  ...INTRA_STATE_PARAMS,
  recipientGstin: '29ABCDE1234F1Z5', // Karnataka (29)
  taxType: 'IGST' as const,
  cgstPaisa: null,
  sgstPaisa: null,
  igstPaisa: 180000,
};

describe('IRP payload builder', () => {
  it('IRP-01: intra-state → supTyp=B2B, pos=27, hsnCd=996913, isServc=Y, regRev=N, CGST+SGST set, IGST=0', () => {
    const payload = buildIrpPayload(INTRA_STATE_PARAMS);

    expect(payload.tranDtls.supTyp).toBe('B2B');
    expect(payload.tranDtls.regRev).toBe('N');
    expect(payload.buyerDtls.pos).toBe('27');
    expect(payload.itemList[0].hsnCd).toBe('996913');
    expect(payload.itemList[0].isServc).toBe('Y');
    expect(payload.itemList[0].cgstAmt).toBeGreaterThan(0);
    expect(payload.itemList[0].sgstAmt).toBeGreaterThan(0);
    expect(payload.itemList[0].igstAmt).toBe(0);
    expect(payload.valDtls.cgstVal).toBeGreaterThan(0);
    expect(payload.valDtls.sgstVal).toBeGreaterThan(0);
    expect(payload.valDtls.igstVal).toBe(0);
  });

  it('IRP-02: inter-state → igstAmt > 0, cgstAmt=0, sgstAmt=0', () => {
    const payload = buildIrpPayload(INTER_STATE_PARAMS);

    expect(payload.itemList[0].igstAmt).toBeGreaterThan(0);
    expect(payload.itemList[0].cgstAmt).toBe(0);
    expect(payload.itemList[0].sgstAmt).toBe(0);
    expect(payload.valDtls.igstVal).toBeGreaterThan(0);
    expect(payload.valDtls.cgstVal).toBe(0);
    expect(payload.valDtls.sgstVal).toBe(0);
  });

  it('IRP-03: invoice number maps to docDtls.no unchanged', () => {
    const payload = buildIrpPayload(INTRA_STATE_PARAMS);
    expect(payload.docDtls.no).toBe('INV/2627/000001');
    expect(payload.docDtls.no.length).toBeLessThanOrEqual(16);
  });

  it('IRP-04: date formatted as DD/MM/YYYY in docDtls.dt', () => {
    const payload = buildIrpPayload(INTRA_STATE_PARAMS);
    // 2026-04-01 → 01/04/2026
    expect(payload.docDtls.dt).toBe('01/04/2026');
  });

  it('IRP-05: paisa → rupees conversion (subtotalPaisa=100000 → assAmt=1000.00)', () => {
    const payload = buildIrpPayload({
      ...INTRA_STATE_PARAMS,
      taxableAmountPaisa: 100000,
      cgstPaisa: 9000,
      sgstPaisa: 9000,
      totalAmountPaisa: 118000,
      totalKwh: 100,
    });
    expect(payload.itemList[0].assAmt).toBe(1000.00);
    expect(payload.valDtls.assVal).toBe(1000.00);
  });

  it('IRP-06: credit note → docDtls.typ=CRN, refDtls.precDocDtls[0].invNo = original invoice number', () => {
    const payload = buildIrpPayload({
      ...INTRA_STATE_PARAMS,
      invoiceNumber: 'CRN/2627/000001',
      docType: 'CRN',
      originalInvoiceNumber: 'INV/2627/000001',
      originalInvoiceDate: '2026-04-01T00:00:00.000Z',
    });

    expect(payload.docDtls.typ).toBe('CRN');
    expect(payload.refDtls).toBeDefined();
    expect(payload.refDtls!.precDocDtls[0].invNo).toBe('INV/2627/000001');
    expect(payload.refDtls!.precDocDtls[0].invDt).toBe('01/04/2026');
  });

  it('IRP-07: buildIrpItemList with totalKwh=0 → unitPrice=0, no divide-by-zero', () => {
    const item = buildIrpItemList({
      subtotalPaisa: 100000,
      totalKwh: 0,
      taxType: 'CGST_SGST',
      cgstPaisa: 9000,
      sgstPaisa: 9000,
      igstPaisa: null,
    });

    expect(item.unitPrice).toBe(0);
    expect(item.qty).toBe(0);
    expect(isFinite(item.unitPrice)).toBe(true);
  });

  test.prop([
    fc.record({
      taxableAmountPaisa: fc.integer({ min: 1, max: 10_000_000 }),
      taxType: fc.constantFrom('CGST_SGST' as const, 'IGST' as const),
      totalKwh: fc.integer({ min: 0, max: 100_000 }),
    }),
  ])('IRP-08: property-based — buildIrpPayload output has valid structure for all inputs', ({ taxableAmountPaisa, taxType, totalKwh }) => {
    const cgstPaisa = taxType === 'CGST_SGST' ? Math.round(taxableAmountPaisa * 0.09) : null;
    const sgstPaisa = taxType === 'CGST_SGST' ? Math.round(taxableAmountPaisa * 0.09) : null;
    const igstPaisa = taxType === 'IGST' ? Math.round(taxableAmountPaisa * 0.18) : null;
    const totalTax = taxType === 'CGST_SGST' ? (cgstPaisa! + sgstPaisa!) : igstPaisa!;
    const totalAmountPaisa = taxableAmountPaisa + totalTax;

    const payload = buildIrpPayload({
      invoiceNumber: 'INV/2627/000001',
      invoiceDate: '2026-04-01T00:00:00.000Z',
      docType: 'INV',
      supplierGstin: '27AAPFU0939F1ZV',
      recipientGstin: taxType === 'CGST_SGST' ? '27XYZPQ9876A1Z3' : '29ABCDE1234F1Z5',
      taxType,
      taxableAmountPaisa,
      cgstPaisa,
      sgstPaisa,
      igstPaisa,
      totalAmountPaisa,
      totalKwh,
      seller: BASE_SELLER,
      buyer: BASE_BUYER,
    });

    // Structural assertions
    expect(payload.version).toBe('1.1');
    expect(payload.tranDtls.taxSch).toBe('GST');
    expect(payload.tranDtls.supTyp).toBe('B2B');
    expect(payload.docDtls.typ).toBe('INV');
    expect(payload.itemList).toHaveLength(1);
    expect(payload.itemList[0].hsnCd).toBe('996913');
    expect(payload.itemList[0].isServc).toBe('Y');
    expect(isFinite(payload.itemList[0].unitPrice)).toBe(true);
    expect(isFinite(payload.valDtls.totInvVal)).toBe(true);
    expect(payload.valDtls.totInvVal).toBeGreaterThan(0);
  });
});
