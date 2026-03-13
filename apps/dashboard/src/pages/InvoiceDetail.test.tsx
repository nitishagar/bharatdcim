import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { InvoiceDetail } from './InvoiceDetail';

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
});
