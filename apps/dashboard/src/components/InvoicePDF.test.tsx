import { render, screen } from '@testing-library/react';

// @react-pdf/renderer requires canvas APIs not available in jsdom; mock it out
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-page">{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Image: ({ src }: { src: string }) => <img data-testid="pdf-image" src={src} />,
  StyleSheet: { create: (s: unknown) => s },
  pdf: vi.fn(),
}));

import { InvoicePDF } from './InvoicePDF';

const baseProps = {
  invoiceNumber: 'INV-2526-001',
  invoiceDate: '2026-02-01',
  supplierGstin: '27ABCDE1234F1Z5',
  recipientGstin: '29XYZAB5678G2Z6',
  taxType: 'CGST_SGST',
  taxableAmountPaisa: 1081500,
  cgstPaisa: 97335,
  sgstPaisa: 97335,
  igstPaisa: null,
  totalTaxPaisa: 194670,
  totalAmountPaisa: 1276170,
  status: 'draft',
  financialYear: '2526',
};

const irnProps = {
  eInvoiceStatus: 'irn_generated' as const,
  irn: 'a'.repeat(64),
  ackNo: '112010000011474',
  ackDt: '2026-03-31 14:30:00',
  qrCodeDataUrl: 'data:image/png;base64,mockQR',
};

describe('InvoicePDF component', () => {
  it('renders invoice number and financial year', () => {
    render(<InvoicePDF {...baseProps} />);
    expect(screen.getByText(/INV-2526-001/)).toBeInTheDocument();
    expect(screen.getByText(/2526/)).toBeInTheDocument();
  });

  it('renders supplier and recipient GSTINs', () => {
    render(<InvoicePDF {...baseProps} />);
    expect(screen.getByText('27ABCDE1234F1Z5')).toBeInTheDocument();
    expect(screen.getByText('29XYZAB5678G2Z6')).toBeInTheDocument();
  });

  it('renders CGST and SGST rows for intra-state invoice', () => {
    render(<InvoicePDF {...baseProps} />);
    expect(screen.getByText('CGST (9%)')).toBeInTheDocument();
    expect(screen.getByText('SGST (9%)')).toBeInTheDocument();
  });

  it('renders IGST row for inter-state invoice', () => {
    render(<InvoicePDF {...baseProps} taxType="IGST" igstPaisa={194670} cgstPaisa={null} sgstPaisa={null} />);
    expect(screen.getByText('IGST (18%)')).toBeInTheDocument();
    expect(screen.queryByText('CGST (9%)')).not.toBeInTheDocument();
  });

  it('PDF-01: renders IRN text and value when eInvoiceStatus=irn_generated', () => {
    render(<InvoicePDF {...baseProps} {...irnProps} />);
    expect(screen.getByText('IRN:')).toBeInTheDocument();
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
  });

  it('PDF-02: renders Image element when signedQrCode/qrCodeDataUrl is present', () => {
    render(<InvoicePDF {...baseProps} {...irnProps} />);
    const img = screen.getByTestId('pdf-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,mockQR');
  });

  it('PDF-03: renders IRN Pending text and no Image when eInvoiceStatus=pending_irn', () => {
    render(<InvoicePDF {...baseProps} eInvoiceStatus="pending_irn" irn={null} qrCodeDataUrl={null} />);
    expect(screen.getByText(/IRN: Pending/)).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-image')).not.toBeInTheDocument();
  });

  it('PDF-04: renders neither IRN text nor Image when eInvoiceStatus=not_applicable', () => {
    render(<InvoicePDF {...baseProps} eInvoiceStatus="not_applicable" irn={null} qrCodeDataUrl={null} />);
    expect(screen.queryByText('IRN:')).not.toBeInTheDocument();
    expect(screen.queryByText(/IRN: Pending/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-image')).not.toBeInTheDocument();
  });
});
