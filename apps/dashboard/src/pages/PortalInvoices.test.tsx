import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { PortalInvoices } from './PortalInvoices';
import { mockInvoice } from '../test/mocks/data';

const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('PortalInvoices', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders TableSkeleton while loading', () => {
    server.use(
      http.get('*/invoices', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<PortalInvoices />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/invoices', () =>
        HttpResponse.json({ error: { message: 'Invoices unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<PortalInvoices />);
    await waitFor(() =>
      expect(screen.getByText('Invoices unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no invoices', async () => {
    server.use(http.get('*/invoices', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<PortalInvoices />);
    await waitFor(() =>
      expect(screen.getByText('No invoices found')).toBeInTheDocument(),
    );
  });

  it('renders invoice list on data load', async () => {
    renderWithProviders(<PortalInvoices />);
    await waitFor(() =>
      expect(screen.getByText(mockInvoice.invoiceNumber)).toBeInTheDocument(),
    );
  });

  it('row click navigates to /portal/invoices/:id', async () => {
    renderWithProviders(<PortalInvoices />);
    await waitFor(() =>
      expect(screen.getByText(mockInvoice.invoiceNumber)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText(mockInvoice.invoiceNumber).closest('tr')!);
    expect(mockNavigate).toHaveBeenCalledWith(`/portal/invoices/${mockInvoice.id}`);
  });
});
