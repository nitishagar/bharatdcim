import { describe, it, expect } from 'vitest';
import {
  determineTaxType, validateGSTIN, calculateInvoiceTax,
} from '../../src/invoice/gst.js';

// Pre-computed valid GSTINs (with correct Luhn mod 36 checksums)
const KA_GSTIN = '29AABCT1332E1ZP'; // Karnataka (state code 29)
const MH_GSTIN = '27AABCT1332E1ZT'; // Maharashtra (state code 27)
const KA_GSTIN2 = '29AADCB2230M1ZP'; // Another KA entity

describe('GST Calculation', () => {
  // INV-G01: Same state → CGST + SGST
  it('INV-G01: intra-state (KA→KA) → CGST + SGST', () => {
    const taxType = determineTaxType(KA_GSTIN, KA_GSTIN2);
    expect(taxType).toBe('CGST_SGST');
  });

  // INV-G02: Different state → IGST
  it('INV-G02: inter-state (KA→MH) → IGST', () => {
    const taxType = determineTaxType(KA_GSTIN, MH_GSTIN);
    expect(taxType).toBe('IGST');
  });

  // INV-G03: Never both CGST+SGST and IGST
  it('INV-G03: tax type is mutually exclusive', () => {
    const intra = calculateInvoiceTax(1000000, 'CGST_SGST');
    expect(intra.cgstPaisa).toBeGreaterThan(0);
    expect(intra.sgstPaisa).toBeGreaterThan(0);
    expect(intra.igstPaisa).toBe(0);

    const inter = calculateInvoiceTax(1000000, 'IGST');
    expect(inter.cgstPaisa).toBe(0);
    expect(inter.sgstPaisa).toBe(0);
    expect(inter.igstPaisa).toBeGreaterThan(0);
  });

  // INV-G04: ₹10,000 taxable intra-state → CGST ₹900, SGST ₹900
  it('INV-G04: ₹10,000 taxable intra-state → CGST ₹900 + SGST ₹900', () => {
    const result = calculateInvoiceTax(1000000, 'CGST_SGST'); // ₹10,000 = 1000000 paisa
    expect(result.cgstPaisa).toBe(90000); // ₹900
    expect(result.sgstPaisa).toBe(90000); // ₹900
    expect(result.totalTaxPaisa).toBe(180000); // ₹1,800
    expect(result.totalAmountPaisa).toBe(1180000); // ₹11,800
  });

  // INV-G05: Invalid GSTIN → error
  it('INV-G05: invalid GSTIN throws error', () => {
    expect(() => determineTaxType('INVALID', KA_GSTIN)).toThrow();
    expect(() => determineTaxType(KA_GSTIN, 'INVALID')).toThrow();
  });
});

describe('Tax Amount Calculations', () => {
  // INV-T01: ₹1L taxable CGST+SGST → ₹1.18L total
  it('INV-T01: ₹1L taxable CGST+SGST → ₹1.18L total', () => {
    const result = calculateInvoiceTax(10000000, 'CGST_SGST');
    expect(result.totalAmountPaisa).toBe(11800000);
  });

  // INV-T02: ₹1L taxable IGST → ₹1.18L total
  it('INV-T02: ₹1L taxable IGST → ₹1.18L total', () => {
    const result = calculateInvoiceTax(10000000, 'IGST');
    expect(result.totalAmountPaisa).toBe(11800000);
  });

  // INV-T03: ₹1 taxable CGST+SGST → ₹1.18 total
  it('INV-T03: ₹1 (100 paisa) CGST+SGST → ₹1.18 (118 paisa)', () => {
    const result = calculateInvoiceTax(100, 'CGST_SGST');
    expect(result.cgstPaisa).toBe(9);
    expect(result.sgstPaisa).toBe(9);
    expect(result.totalAmountPaisa).toBe(118);
  });

  // INV-T04: ₹99.99 → verify rounding
  it('INV-T04: ₹99.99 (9999 paisa) CGST+SGST → correct rounding', () => {
    const result = calculateInvoiceTax(9999, 'CGST_SGST');
    // 9999 * 9% = 899.91 → rounds to 900
    expect(result.cgstPaisa).toBe(900);
    expect(result.sgstPaisa).toBe(900);
    expect(result.totalTaxPaisa).toBe(1800);
    expect(result.totalAmountPaisa).toBe(11799);
  });

  // INV-T05: Zero taxable → zero total
  it('INV-T05: zero taxable → zero total', () => {
    const result = calculateInvoiceTax(0, 'CGST_SGST');
    expect(result.totalTaxPaisa).toBe(0);
    expect(result.totalAmountPaisa).toBe(0);
  });
});

describe('GSTIN Validation', () => {
  it('accepts valid KA GSTIN', () => {
    const result = validateGSTIN(KA_GSTIN);
    expect(result.valid).toBe(true);
    expect(result.stateCode).toBe('29');
  });

  it('accepts valid MH GSTIN', () => {
    const result = validateGSTIN(MH_GSTIN);
    expect(result.valid).toBe(true);
    expect(result.stateCode).toBe('27');
  });

  it('rejects too short', () => {
    expect(validateGSTIN('29AABCT').valid).toBe(false);
  });

  it('rejects invalid state code', () => {
    expect(validateGSTIN('99AABCT1332E1ZX').valid).toBe(false);
  });

  it('rejects bad checksum', () => {
    // Change last char to X (wrong checksum)
    expect(validateGSTIN('29AABCT1332E1ZX').valid).toBe(false);
  });

  it('rejects missing Z at position 14', () => {
    expect(validateGSTIN('29AABCT1332E1AX').valid).toBe(false);
  });
});
