import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { mockBill } from '../test/mocks/data';
import type { Bill } from '../api/hooks/useBills';
import { BillDetail } from './BillDetail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'bill-001' }), useNavigate: () => mockNavigate };
});

describe('BillDetail page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/bills/:id', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<BillDetail />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders bill details on data load', async () => {
    renderWithProviders(<BillDetail />);
    // Heading and breadcrumb both render "Bill Detail" — use heading role
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Bill Detail' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Charge Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Line Items')).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/bills/:id', () =>
        HttpResponse.json({ error: { message: 'Bill not found' } }, { status: 404 }),
      ),
    );
    renderWithProviders(<BillDetail />);
    await waitFor(() =>
      expect(screen.getByText('Bill not found')).toBeInTheDocument(),
    );
  });

  it('shows Delete Bill button for draft bill and opens confirm dialog', async () => {
    renderWithProviders(<BillDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bill Detail' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bill' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this draft bill/)).toBeInTheDocument();
  });

  it('calls DELETE API and navigates to /billing on confirm', async () => {
    let deleted = false;
    server.use(http.delete('*/bills/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    renderWithProviders(<BillDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Bill' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Bill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/billing'));
  });

  it('hides Delete Bill button for non-draft bill', async () => {
    server.use(http.get('*/bills/:id', () => HttpResponse.json({ ...mockBill, status: 'invoiced' })));
    renderWithProviders(<BillDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bill Detail' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete Bill' })).not.toBeInTheDocument();
  });

  it('shows OA line items when non-zero OA charges are present', async () => {
    const oaBill: Bill = {
      ...mockBill,
      ppaEnergyChargesPaisa: 160000,
      crossSubsidySurchargePaisa: 60000,
      additionalSurchargePaisa: 20000,
      transmissionLossChargesPaisa: 16000,
    };
    server.use(http.get('*/bills/:id', () => HttpResponse.json(oaBill)));
    renderWithProviders(<BillDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bill Detail' })).toBeInTheDocument());
    expect(screen.getByText('PPA Energy Charges')).toBeInTheDocument();
    expect(screen.getByText('Cross-Subsidy Surcharge (CSS)')).toBeInTheDocument();
    expect(screen.getByText('Additional Surcharge')).toBeInTheDocument();
    expect(screen.getByText('Transmission Loss')).toBeInTheDocument();
  });

  it('hides OA line items when OA charges are zero', async () => {
    renderWithProviders(<BillDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bill Detail' })).toBeInTheDocument());
    expect(screen.queryByText('PPA Energy Charges')).not.toBeInTheDocument();
    expect(screen.queryByText('Cross-Subsidy Surcharge (CSS)')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional Surcharge')).not.toBeInTheDocument();
    expect(screen.queryByText('Transmission Loss')).not.toBeInTheDocument();
  });
});
