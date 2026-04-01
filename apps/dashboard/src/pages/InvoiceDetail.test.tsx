import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { InvoiceDetail } from './InvoiceDetail';
import { mockInvoice, mockInvoiceNotApplicable } from '../test/mocks/data';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (s: unknown) => s },
  pdf: vi.fn().mockReturnValue({ toBlob: vi.fn().mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' })) }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'invoice-001' }) };
});

describe('InvoiceDetail page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/invoices/:id', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<InvoiceDetail />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders invoice details on data load', async () => {
    renderWithProviders(<InvoiceDetail />);
    // h2 and breadcrumb both render the invoice number — target the heading
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'INV-2026-001' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Supplier GSTIN')).toBeInTheDocument();
    expect(screen.getByText('Cancel Invoice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/invoices/:id', () =>
        HttpResponse.json({ error: { message: 'Invoice not found' } }, { status: 404 }),
      ),
    );
    renderWithProviders(<InvoiceDetail />);
    await waitFor(() =>
      expect(screen.getByText('Invoice not found')).toBeInTheDocument(),
    );
  });

  it('DETAIL-01: renders IRN Generated badge for irn_generated status', async () => {
    renderWithProviders(<InvoiceDetail />);
    await waitFor(() =>
      expect(screen.getByText('IRN Generated')).toBeInTheDocument(),
    );
  });

  it('DETAIL-02: IRP badge absent when eInvoiceStatus=not_applicable', async () => {
    server.use(
      http.get('*/invoices/:id', () => HttpResponse.json(mockInvoiceNotApplicable)),
    );
    renderWithProviders(<InvoiceDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'INV-2026-003' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('IRN Generated')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending IRN')).not.toBeInTheDocument();
    expect(screen.queryByText('IRN Cancelled')).not.toBeInTheDocument();
  });

  it('DETAIL-03: cancel form shows select with enum options not free-text input', async () => {
    renderWithProviders(<InvoiceDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: mockInvoice.invoiceNumber })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Invoice' }));
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Data Entry Mistake' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Order Cancelled' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument();
  });
});
