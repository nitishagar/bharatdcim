import Decimal from 'decimal.js';

// Valid Indian state/UT codes (01-37, plus newer codes)
const VALID_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
]);

// Luhn mod 36 character set (0-9, A-Z)
const LUHN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function luhnMod36Checksum(input: string): string {
  let factor = 2;
  let sum = 0;
  const n = 36;

  for (let i = input.length - 1; i >= 0; i--) {
    let codePoint = LUHN_CHARS.indexOf(input[i].toUpperCase());
    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / n) + (addend % n);
    sum += addend;
  }

  const remainder = sum % n;
  const checkCodePoint = (n - remainder) % n;
  return LUHN_CHARS[checkCodePoint];
}

export type TaxType = 'CGST_SGST' | 'IGST';

export interface GSTINValidation {
  valid: boolean;
  stateCode: string;
  error?: string;
}

export interface TaxBreakdown {
  taxType: TaxType;
  cgstPaisa: number;
  sgstPaisa: number;
  igstPaisa: number;
  totalTaxPaisa: number;
  totalAmountPaisa: number;
}

/**
 * Validate a GSTIN (Goods and Services Tax Identification Number).
 * Format: 2-digit state code + 10-char PAN + entity number + 'Z' + checksum
 */
export function validateGSTIN(gstin: string): GSTINValidation {
  if (typeof gstin !== 'string' || gstin.length !== 15) {
    return { valid: false, stateCode: '', error: 'GSTIN must be exactly 15 characters' };
  }

  const upper = gstin.toUpperCase();

  // Characters 1-2: State code
  const stateCode = upper.substring(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    return { valid: false, stateCode, error: `Invalid state code: ${stateCode}` };
  }

  // Characters 3-7: First 5 chars of PAN (letters)
  if (!/^[A-Z]{5}$/.test(upper.substring(2, 7))) {
    return { valid: false, stateCode, error: 'PAN portion (chars 3-7) must be letters' };
  }

  // Characters 8-11: Next 4 chars of PAN (digits)
  if (!/^\d{4}$/.test(upper.substring(7, 11))) {
    return { valid: false, stateCode, error: 'PAN portion (chars 8-11) must be digits' };
  }

  // Character 12: Last char of PAN (letter)
  if (!/^[A-Z]$/.test(upper[11])) {
    return { valid: false, stateCode, error: 'PAN portion (char 12) must be a letter' };
  }

  // Character 13: Entity number (1-9, A-Z)
  if (!/^[1-9A-Z]$/.test(upper[12])) {
    return { valid: false, stateCode, error: 'Entity number (char 13) must be 1-9 or A-Z' };
  }

  // Character 14: Must be 'Z' (default)
  if (upper[13] !== 'Z') {
    return { valid: false, stateCode, error: 'Character 14 must be Z' };
  }

  // Character 15: Checksum (Luhn mod 36)
  const expectedChecksum = luhnMod36Checksum(upper.substring(0, 14));
  if (upper[14] !== expectedChecksum) {
    return { valid: false, stateCode, error: 'Invalid checksum' };
  }

  return { valid: true, stateCode };
}

/**
 * Determine tax type based on supplier and recipient GSTINs.
 * Same state → CGST + SGST (intra-state)
 * Different state → IGST (inter-state)
 */
export function determineTaxType(supplierGSTIN: string, recipientGSTIN: string): TaxType {
  const supplierValidation = validateGSTIN(supplierGSTIN);
  if (!supplierValidation.valid) {
    throw new Error(`Invalid supplier GSTIN: ${supplierValidation.error}`);
  }

  const recipientValidation = validateGSTIN(recipientGSTIN);
  if (!recipientValidation.valid) {
    throw new Error(`Invalid recipient GSTIN: ${recipientValidation.error}`);
  }

  return supplierValidation.stateCode === recipientValidation.stateCode ? 'CGST_SGST' : 'IGST';
}

/**
 * Calculate GST tax breakdown.
 * @param gstRateBps - GST rate in basis points (default 1800 = 18%)
 */
export function calculateInvoiceTax(taxableAmountPaisa: number, taxType: TaxType, gstRateBps = 1800): TaxBreakdown {
  if (taxableAmountPaisa === 0) {
    return { taxType, cgstPaisa: 0, sgstPaisa: 0, igstPaisa: 0, totalTaxPaisa: 0, totalAmountPaisa: 0 };
  }

  const taxable = new Decimal(taxableAmountPaisa);

  if (taxType === 'CGST_SGST') {
    // CGST = SGST = gstRateBps / 2 (each half of total GST)
    const cgst = Math.round(taxable.mul(gstRateBps).div(20000).toNumber());
    const sgst = Math.round(taxable.mul(gstRateBps).div(20000).toNumber());
    const totalTax = cgst + sgst;
    return {
      taxType,
      cgstPaisa: cgst,
      sgstPaisa: sgst,
      igstPaisa: 0,
      totalTaxPaisa: totalTax,
      totalAmountPaisa: taxableAmountPaisa + totalTax,
    };
  }

  // IGST = full gstRateBps
  const igst = Math.round(taxable.mul(gstRateBps).div(10000).toNumber());
  return {
    taxType,
    cgstPaisa: 0,
    sgstPaisa: 0,
    igstPaisa: igst,
    totalTaxPaisa: igst,
    totalAmountPaisa: taxableAmountPaisa + igst,
  };
}
