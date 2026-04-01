import Decimal from 'decimal.js';

// ─── IRP Payload Types ─────────────────────────────────────────

export interface IRPAddress {
  gstin: string;
  lglNm: string;
  addr1: string;
  loc: string;
  pin: number;
  stcd: string;
}

export interface IRPItem {
  slNo: string;
  prdDesc: string;
  isServc: 'Y';
  hsnCd: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totAmt: number;
  assAmt: number;
  gstRt: number;
  igstAmt: number;
  cgstAmt: number;
  sgstAmt: number;
  totItemVal: number;
}

export interface IRPPayload {
  version: '1.1';
  tranDtls: { taxSch: 'GST'; supTyp: 'B2B'; regRev: 'N'; igstOnIntra: 'N' };
  docDtls: { typ: 'INV' | 'CRN'; no: string; dt: string }; // dt: DD/MM/YYYY
  sellerDtls: IRPAddress;
  buyerDtls: IRPAddress & { pos: string };
  itemList: [IRPItem, ...IRPItem[]];
  valDtls: { assVal: number; cgstVal: number; sgstVal: number; igstVal: number; totInvVal: number };
  refDtls?: { precDocDtls: Array<{ invNo: string; invDt: string }> };
}

// ─── Helpers ───────────────────────────────────────────────────

function paisaToRupees(paisa: number): number {
  return new Decimal(paisa).dividedBy(100).toDecimalPlaces(2).toNumber();
}

function formatIRPDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function stateCodeFromGstin(gstin: string): string {
  return gstin.substring(0, 2);
}

// ─── Item builder ─────────────────────────────────────────────

export function buildIrpItemList(params: {
  subtotalPaisa: number;
  totalKwh: number;
  taxType: 'CGST_SGST' | 'IGST';
  cgstPaisa: number | null;
  sgstPaisa: number | null;
  igstPaisa: number | null;
}): IRPItem {
  const { subtotalPaisa, totalKwh, taxType, cgstPaisa, sgstPaisa, igstPaisa } = params;

  const assAmt = paisaToRupees(subtotalPaisa);
  const cgstAmt = taxType === 'CGST_SGST' ? paisaToRupees(cgstPaisa ?? 0) : 0;
  const sgstAmt = taxType === 'CGST_SGST' ? paisaToRupees(sgstPaisa ?? 0) : 0;
  const igstAmt = taxType === 'IGST' ? paisaToRupees(igstPaisa ?? 0) : 0;
  const totItemVal = new Decimal(assAmt).plus(igstAmt).plus(cgstAmt).plus(sgstAmt).toDecimalPlaces(2).toNumber();

  const unitPrice = totalKwh === 0 ? 0 : new Decimal(assAmt).dividedBy(totalKwh).toDecimalPlaces(2).toNumber();

  return {
    slNo: '1',
    prdDesc: 'Electricity Supply Service',
    isServc: 'Y',
    hsnCd: '996913',
    qty: totalKwh,
    unit: 'KWH',
    unitPrice,
    totAmt: assAmt,
    assAmt,
    gstRt: 18,
    igstAmt,
    cgstAmt,
    sgstAmt,
    totItemVal,
  };
}

// ─── Payload builder ──────────────────────────────────────────

export function buildIrpPayload(params: {
  invoiceNumber: string;
  invoiceDate: string;
  docType: 'INV' | 'CRN';
  supplierGstin: string;
  recipientGstin: string;
  taxType: 'CGST_SGST' | 'IGST';
  taxableAmountPaisa: number;
  cgstPaisa: number | null;
  sgstPaisa: number | null;
  igstPaisa: number | null;
  totalAmountPaisa: number;
  totalKwh: number;
  seller: { lglNm: string; addr1: string; loc: string; pin: number };
  buyer: { lglNm: string; addr1: string; loc: string; pin: number };
  originalInvoiceNumber?: string;
  originalInvoiceDate?: string;
}): IRPPayload {
  const {
    invoiceNumber, invoiceDate, docType,
    supplierGstin, recipientGstin, taxType,
    taxableAmountPaisa, cgstPaisa, sgstPaisa, igstPaisa, totalAmountPaisa,
    totalKwh, seller, buyer,
    originalInvoiceNumber, originalInvoiceDate,
  } = params;

  const sellerStateCode = stateCodeFromGstin(supplierGstin);
  const buyerStateCode = stateCodeFromGstin(recipientGstin);

  const sellerDtls: IRPAddress = {
    gstin: supplierGstin,
    lglNm: seller.lglNm,
    addr1: seller.addr1,
    loc: seller.loc,
    pin: seller.pin,
    stcd: sellerStateCode,
  };

  const buyerDtls = {
    gstin: recipientGstin,
    lglNm: buyer.lglNm,
    addr1: buyer.addr1,
    loc: buyer.loc,
    pin: buyer.pin,
    stcd: buyerStateCode,
    pos: buyerStateCode,
  };

  const item = buildIrpItemList({
    subtotalPaisa: taxableAmountPaisa,
    totalKwh,
    taxType,
    cgstPaisa,
    sgstPaisa,
    igstPaisa,
  });

  const assVal = paisaToRupees(taxableAmountPaisa);
  const cgstVal = taxType === 'CGST_SGST' ? paisaToRupees(cgstPaisa ?? 0) : 0;
  const sgstVal = taxType === 'CGST_SGST' ? paisaToRupees(sgstPaisa ?? 0) : 0;
  const igstVal = taxType === 'IGST' ? paisaToRupees(igstPaisa ?? 0) : 0;
  const totInvVal = paisaToRupees(totalAmountPaisa);

  const payload: IRPPayload = {
    version: '1.1',
    tranDtls: { taxSch: 'GST', supTyp: 'B2B', regRev: 'N', igstOnIntra: 'N' },
    docDtls: {
      typ: docType,
      no: invoiceNumber,
      dt: formatIRPDate(invoiceDate),
    },
    sellerDtls,
    buyerDtls,
    itemList: [item],
    valDtls: { assVal, cgstVal, sgstVal, igstVal, totInvVal },
  };

  if (docType === 'CRN' && originalInvoiceNumber) {
    payload.refDtls = {
      precDocDtls: [{
        invNo: originalInvoiceNumber,
        invDt: originalInvoiceDate ? formatIRPDate(originalInvoiceDate) : '',
      }],
    };
  }

  return payload;
}
