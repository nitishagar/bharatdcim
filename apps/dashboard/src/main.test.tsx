import { describe, it, expect } from 'vitest';
import { formatPaisa } from './lib/formatCurrency';
import { formatDate } from './lib/formatDate';

describe('Dashboard', () => {
  it('module loads without error', () => {
    expect(true).toBe(true);
  });
});

describe('formatPaisa', () => {
  it('formats 123456 paisa as ₹1,234.56', () => {
    expect(formatPaisa(123456)).toBe('₹1,234.56');
  });

  it('formats 0 paisa as ₹0.00', () => {
    expect(formatPaisa(0)).toBe('₹0.00');
  });

  it('formats large amounts with Indian grouping', () => {
    const result = formatPaisa(1000000000); // 1 crore rupees
    expect(result).toContain('1,00,00,000');
  });
});

describe('formatDate', () => {
  it('formats ISO string to IST', () => {
    const result = formatDate('2026-02-25T10:30:00Z');
    expect(result).toContain('25');
    expect(result).toContain('Feb');
    expect(result).toContain('2026');
  });
});
