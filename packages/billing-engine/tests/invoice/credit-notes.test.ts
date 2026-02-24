import { describe, it, expect } from 'vitest';
import { validateCreditNote } from '../../src/invoice/credit-note.js';

describe('Credit Note Validation', () => {
  // INV-C01: Valid credit note — amount < original
  it('INV-C01: valid credit note — amount < original', () => {
    const result = validateCreditNote(
      500000, // ₹5,000
      1000000, // ₹10,000 original
      new Date(2026, 5, 15), // June 15, 2026
      new Date(2026, 4, 1), // May 1, 2026 (FY 2627)
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // INV-C02: Exceeds original → error
  it('INV-C02: credit note exceeding original → error', () => {
    const result = validateCreditNote(
      1500000, // ₹15,000
      1000000, // ₹10,000 original
      new Date(2026, 5, 15),
      new Date(2026, 4, 1),
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds');
  });

  // INV-C03: Tax reversal matches — tested via tax type at invoice creation level
  // Here we just verify equal amounts are accepted
  it('INV-C03: exact amount match is valid', () => {
    const result = validateCreditNote(
      1000000,
      1000000,
      new Date(2026, 5, 15),
      new Date(2026, 4, 1),
    );
    expect(result.valid).toBe(true);
  });

  // INV-C04: Time limit — after Sep 30 next FY → error
  it('INV-C04: after September 30 of next FY → error', () => {
    // Invoice from May 2026 (FY 2627, ends March 2027)
    // Deadline is Sep 30, 2027
    const result = validateCreditNote(
      500000,
      1000000,
      new Date(2027, 9, 1), // October 1, 2027 (past deadline)
      new Date(2026, 4, 1), // May 1, 2026
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain('September 30');
  });

  it('credit note on September 30 deadline is valid', () => {
    const result = validateCreditNote(
      500000,
      1000000,
      new Date(2027, 8, 30, 12, 0, 0), // Sep 30, 2027 noon
      new Date(2026, 4, 1), // May 1, 2026
    );
    expect(result.valid).toBe(true);
  });

  it('credit note for January invoice uses correct FY boundary', () => {
    // Invoice from January 2027 (FY 2627, since Jan is still in FY that started Apr 2026)
    // FY ends March 2027, deadline is Sep 30, 2027
    const result = validateCreditNote(
      500000,
      1000000,
      new Date(2027, 9, 1), // October 1, 2027 (past deadline for FY 2627)
      new Date(2027, 0, 15), // January 15, 2027 (FY 2627)
    );
    expect(result.valid).toBe(false);
  });
});
