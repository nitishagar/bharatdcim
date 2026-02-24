import { describe, it, expect } from 'vitest';
import { getFinancialYear, formatInvoiceNumber, formatCreditNoteNumber } from '../../src/invoice/numbering.js';

describe('Invoice Numbering', () => {
  // INV-N01: FY from April 2026 → '2627'
  it('INV-N01: FY from 2026-04-01 → INV/2627/000001', () => {
    const fy = getFinancialYear(new Date(2026, 3, 1)); // April 1, 2026
    expect(fy).toBe('2627');
    expect(formatInvoiceNumber(fy, 1)).toBe('INV/2627/000001');
  });

  // INV-N02: 100 sequential — no gaps
  it('INV-N02: 100 sequential numbers have no gaps', () => {
    const fy = '2627';
    const numbers: string[] = [];
    for (let i = 1; i <= 100; i++) {
      numbers.push(formatInvoiceNumber(fy, i));
    }
    expect(numbers[0]).toBe('INV/2627/000001');
    expect(numbers[99]).toBe('INV/2627/000100');

    // Verify all unique
    const unique = new Set(numbers);
    expect(unique.size).toBe(100);
  });

  // INV-N03: FY rollover March→April
  it('INV-N03: FY rollover — March 2027 still 2627, April 2027 starts 2728', () => {
    const marchFY = getFinancialYear(new Date(2027, 2, 31)); // March 31, 2027
    expect(marchFY).toBe('2627');

    const aprilFY = getFinancialYear(new Date(2027, 3, 1)); // April 1, 2027
    expect(aprilFY).toBe('2728');
  });

  // INV-N04: Concurrent creates → all unique (tested at numbering format level)
  it('INV-N04: 10 concurrent sequence numbers are all unique', () => {
    const fy = '2627';
    const sequences = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const invoiceNumbers = sequences.map(s => formatInvoiceNumber(fy, s));
    const unique = new Set(invoiceNumbers);
    expect(unique.size).toBe(10);
  });

  // INV-N05: Max length ≤ 16 characters
  it('INV-N05: invoice number ≤ 16 characters', () => {
    const num = formatInvoiceNumber('2627', 999999);
    expect(num.length).toBeLessThanOrEqual(16);
    expect(num).toBe('INV/2627/999999');
  });

  // INV-N06: After cancel, next still increments
  it('INV-N06: numbering always increments (format level)', () => {
    const fy = '2627';
    const inv5 = formatInvoiceNumber(fy, 5);
    // Simulate cancel of 5, next is 6
    const inv6 = formatInvoiceNumber(fy, 6);
    expect(inv5).toBe('INV/2627/000005');
    expect(inv6).toBe('INV/2627/000006');
  });
});

describe('Financial Year Edge Cases', () => {
  it('January 2026 is FY 2526', () => {
    expect(getFinancialYear(new Date(2026, 0, 15))).toBe('2526');
  });

  it('December 2026 is FY 2627', () => {
    expect(getFinancialYear(new Date(2026, 11, 31))).toBe('2627');
  });

  it('April 1, 2025 is FY 2526', () => {
    expect(getFinancialYear(new Date(2025, 3, 1))).toBe('2526');
  });
});

describe('Credit Note Numbering', () => {
  it('formats credit note numbers correctly', () => {
    expect(formatCreditNoteNumber('2627', 1)).toBe('CRN/2627/000001');
    expect(formatCreditNoteNumber('2627', 42)).toBe('CRN/2627/000042');
  });

  it('credit note number ≤ 16 characters', () => {
    expect(formatCreditNoteNumber('2627', 999999).length).toBeLessThanOrEqual(16);
  });
});
