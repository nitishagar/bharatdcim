import { render, screen } from '@testing-library/react';

// @react-pdf/renderer requires canvas APIs not available in jsdom; mock it out
vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-document">{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div data-testid="pdf-page">{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
});
