import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import type { invoices, tenants } from '../db/schema.js';
import type { Bindings } from '../types.js';

type Invoice = typeof invoices.$inferSelect;
type Tenant = typeof tenants.$inferSelect;

function formatPaisa(paisa: number): string {
  return `INR ${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function renderInvoicePdf(
  invoice: Invoice,
  tenant: Tenant,
  env: Pick<Bindings, 'PLATFORM_GSTIN' | 'PLATFORM_LEGAL_NAME' | 'PLATFORM_ADDRESS1' | 'PLATFORM_CITY' | 'PLATFORM_PINCODE'>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const left = 50;
  const right = width - 50;
  const lineH = 18;

  function text(str: string, x: number, yPos: number, size = 10, isBold = false) {
    page.drawText(str, { x, y: yPos, size, font: isBold ? bold : font, color: rgb(0, 0, 0) });
  }
  function line(yPos: number) {
    page.drawLine({ start: { x: left, y: yPos }, end: { x: right, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  }

  // Header
  text('TAX INVOICE', left, y, 16, true);
  text('BharatDCIM', right - 130, y, 14, true);
  y -= lineH * 1.5;

  text(`Invoice No: ${invoice.invoiceNumber}`, left, y, 10, true);
  text(env.PLATFORM_LEGAL_NAME ?? 'BharatDCIM Pvt Ltd', right - 130, y, 9);
  y -= lineH;

  text(`Date: ${invoice.invoiceDate.slice(0, 10)}`, left, y, 9);
  text(env.PLATFORM_GSTIN ? `GSTIN: ${env.PLATFORM_GSTIN}` : '', right - 130, y, 9);
  y -= lineH;

  text(`FY: 20${invoice.financialYear.slice(0, 2)}-${invoice.financialYear.slice(2)}`, left, y, 9);
  const platformAddr = [env.PLATFORM_ADDRESS1, env.PLATFORM_CITY, env.PLATFORM_PINCODE].filter(Boolean).join(', ');
  if (platformAddr) text(platformAddr.slice(0, 60), right - 130, y, 8);
  y -= lineH * 1.5;

  line(y); y -= lineH;

  // Supplier / recipient
  text('Bill To:', left, y, 9, true);
  y -= lineH;
  text(tenant.legalName ?? tenant.name, left, y, 9);
  y -= lineH;
  if (tenant.address1) { text(tenant.address1.slice(0, 80), left, y, 8); y -= lineH; }
  if (tenant.gstin) { text(`GSTIN: ${invoice.recipientGstin}`, left, y, 8); y -= lineH; }
  y -= lineH * 0.5;

  line(y); y -= lineH;

  // Service row header
  text('Description', left, y, 9, true);
  text('Taxable Amount', right - 170, y, 9, true);
  y -= lineH;

  text('Power supply charges (energy consumed)', left, y, 9);
  text(formatPaisa(invoice.taxableAmountPaisa), right - 130, y, 9);
  y -= lineH * 1.5;

  line(y); y -= lineH;

  // GST rows
  if (invoice.taxType === 'CGST_SGST') {
    text('CGST @9%', left, y, 9);
    text(formatPaisa(invoice.cgstPaisa ?? 0), right - 130, y, 9);
    y -= lineH;
    text('SGST @9%', left, y, 9);
    text(formatPaisa(invoice.sgstPaisa ?? 0), right - 130, y, 9);
  } else {
    text('IGST @18%', left, y, 9);
    text(formatPaisa(invoice.igstPaisa ?? 0), right - 130, y, 9);
  }
  y -= lineH * 1.5;

  line(y); y -= lineH;

  text('Total Amount (INR)', left, y, 11, true);
  text(formatPaisa(invoice.totalAmountPaisa), right - 130, y, 11, true);
  y -= lineH * 2;

  // IRN block if available
  if (invoice.irn) {
    line(y); y -= lineH;
    text('IRP Details', left, y, 9, true);
    y -= lineH;
    text(`IRN: ${invoice.irn}`, left, y, 7);
    y -= lineH;
    if (invoice.ackNo) text(`Ack No: ${invoice.ackNo}   Ack Date: ${invoice.ackDt ?? ''}`, left, y, 7);
    y -= lineH;

    // Embed QR if present (data URL → Uint8Array)
    if (invoice.signedQrCode) {
      try {
        const qrDataUrl = invoice.signedQrCode;
        const base64Part = qrDataUrl.split(',')[1];
        if (base64Part) {
          const binaryStr = atob(base64Part);
          const qrBytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) qrBytes[i] = binaryStr.charCodeAt(i);
          const qrImg = await doc.embedPng(qrBytes);
          page.drawImage(qrImg, { x: left, y: y - 80, width: 80, height: 80 });
        }
      } catch {
        // QR embed optional — silently skip if format unsupported
      }
    }
  }

  // Footer
  page.drawText('This is a computer-generated invoice — no signature required.', {
    x: left, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}
