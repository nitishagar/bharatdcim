import {
  calculateBillSchema,
  createInvoiceSchema,
  cancelInvoiceSchema,
  creditNoteSchema,
  createMeterSchema,
  createTariffSchema,
  createTenantSchema,
} from './schemas';

const validGSTIN = '29ABCDE1234F1Z5';

// ─── calculateBillSchema ───────────────────────────────────────────────────

describe('calculateBillSchema', () => {
  const valid = {
    meterId: 'meter-001',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    peakKwh: '200',
    normalKwh: '600',
    offPeakKwh: '200',
    contractedDemandKva: '100',
    recordedDemandKva: '90',
    powerFactor: '0.95',
  };

  it('accepts a valid bill calculation input', () => {
    expect(calculateBillSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing meterId', () => {
    expect(calculateBillSchema.safeParse({ ...valid, meterId: '' }).success).toBe(false);
  });

  it('rejects missing periodStart', () => {
    expect(calculateBillSchema.safeParse({ ...valid, periodStart: '' }).success).toBe(false);
  });

  it('rejects missing periodEnd', () => {
    expect(calculateBillSchema.safeParse({ ...valid, periodEnd: '' }).success).toBe(false);
  });
});

// ─── createInvoiceSchema ──────────────────────────────────────────────────

describe('createInvoiceSchema', () => {
  const valid = {
    billId: 'bill-001',
    supplierGSTIN: validGSTIN,
    recipientGSTIN: validGSTIN,
  };

  it('accepts valid GSTINs', () => {
    expect(createInvoiceSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing billId', () => {
    expect(createInvoiceSchema.safeParse({ ...valid, billId: '' }).success).toBe(false);
  });

  it('rejects invalid supplier GSTIN format', () => {
    const result = createInvoiceSchema.safeParse({ ...valid, supplierGSTIN: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid recipient GSTIN format', () => {
    const result = createInvoiceSchema.safeParse({ ...valid, recipientGSTIN: '12345' });
    expect(result.success).toBe(false);
  });

  it('accepts another valid GSTIN pattern', () => {
    expect(
      createInvoiceSchema.safeParse({
        ...valid,
        supplierGSTIN: '27AAAPZ2323P1ZV',
        recipientGSTIN: '07AABCU9603R1ZP',
      }).success,
    ).toBe(true);
  });
});

// ─── cancelInvoiceSchema ──────────────────────────────────────────────────

describe('cancelInvoiceSchema', () => {
  it('accepts valid enum reasons', () => {
    expect(cancelInvoiceSchema.safeParse({ reason: 'Duplicate' }).success).toBe(true);
    expect(cancelInvoiceSchema.safeParse({ reason: 'Data Entry Mistake' }).success).toBe(true);
    expect(cancelInvoiceSchema.safeParse({ reason: 'Order Cancelled' }).success).toBe(true);
    expect(cancelInvoiceSchema.safeParse({ reason: 'Other' }).success).toBe(true);
  });

  it('rejects invalid reason not in enum', () => {
    expect(cancelInvoiceSchema.safeParse({ reason: 'Duplicate invoice' }).success).toBe(false);
    expect(cancelInvoiceSchema.safeParse({ reason: '' }).success).toBe(false);
  });
});

// ─── creditNoteSchema ─────────────────────────────────────────────────────

describe('creditNoteSchema', () => {
  it('accepts valid amount and reason', () => {
    expect(creditNoteSchema.safeParse({ amount: '5000', reason: 'Overbilling' }).success).toBe(true);
  });

  it('rejects empty amount', () => {
    expect(creditNoteSchema.safeParse({ amount: '', reason: 'Reason' }).success).toBe(false);
  });

  it('rejects zero amount', () => {
    expect(creditNoteSchema.safeParse({ amount: '0', reason: 'Reason' }).success).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(creditNoteSchema.safeParse({ amount: '-100', reason: 'Reason' }).success).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(creditNoteSchema.safeParse({ amount: '500', reason: '' }).success).toBe(false);
  });
});

// ─── createMeterSchema ────────────────────────────────────────────────────

describe('createMeterSchema', () => {
  const valid = { name: 'Main Meter', stateCode: 'KA' };

  it('accepts required fields only', () => {
    expect(createMeterSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional fields', () => {
    expect(
      createMeterSchema.safeParse({
        ...valid,
        siteId: 'site-1',
        tariffId: 'tariff-1',
        meterType: 'grid',
      }).success,
    ).toBe(true);
  });

  it('rejects missing name', () => {
    expect(createMeterSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects missing stateCode', () => {
    expect(createMeterSchema.safeParse({ ...valid, stateCode: '' }).success).toBe(false);
  });

  it('rejects invalid meterType enum value', () => {
    expect(createMeterSchema.safeParse({ ...valid, meterType: 'wind' }).success).toBe(false);
  });
});

// ─── createTariffSchema ───────────────────────────────────────────────────

describe('createTariffSchema', () => {
  const valid = {
    stateCode: 'KA',
    discom: 'BESCOM',
    category: 'HT',
    baseEnergyRatePaisa: '700',
    effectiveFrom: '2026-01-01',
  };

  it('accepts required fields only', () => {
    expect(createTariffSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects missing stateCode', () => {
    expect(createTariffSchema.safeParse({ ...valid, stateCode: '' }).success).toBe(false);
  });

  it('rejects zero baseEnergyRatePaisa', () => {
    expect(createTariffSchema.safeParse({ ...valid, baseEnergyRatePaisa: '0' }).success).toBe(false);
  });

  it('rejects non-numeric baseEnergyRatePaisa', () => {
    expect(createTariffSchema.safeParse({ ...valid, baseEnergyRatePaisa: 'abc' }).success).toBe(false);
  });

  it('accepts valid billingUnit enum values', () => {
    expect(createTariffSchema.safeParse({ ...valid, billingUnit: 'kWh' }).success).toBe(true);
    expect(createTariffSchema.safeParse({ ...valid, billingUnit: 'kVAh' }).success).toBe(true);
  });

  it('rejects invalid billingUnit', () => {
    expect(createTariffSchema.safeParse({ ...valid, billingUnit: 'MW' }).success).toBe(false);
  });
});

// ─── createTenantSchema ───────────────────────────────────────────────────

describe('createTenantSchema', () => {
  const valid = { name: 'Delhi DC', stateCode: 'DL' };

  it('accepts required fields only', () => {
    expect(createTenantSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts optional gstin and billingAddress', () => {
    expect(
      createTenantSchema.safeParse({
        ...valid,
        gstin: '07AABCU9603R1ZP',
        billingAddress: '123 Connaught Place, New Delhi',
      }).success,
    ).toBe(true);
  });

  it('rejects missing name', () => {
    expect(createTenantSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects missing stateCode', () => {
    expect(createTenantSchema.safeParse({ ...valid, stateCode: '' }).success).toBe(false);
  });

  it('accepts undefined gstin (optional)', () => {
    expect(createTenantSchema.safeParse({ ...valid, gstin: undefined }).success).toBe(true);
  });

  it('rejects malformed gstin when provided', () => {
    expect(createTenantSchema.safeParse({ ...valid, gstin: 'INVALID' }).success).toBe(false);
  });

  it('accepts empty string gstin (treated as not provided)', () => {
    expect(createTenantSchema.safeParse({ ...valid, gstin: '' }).success).toBe(true);
  });
});
