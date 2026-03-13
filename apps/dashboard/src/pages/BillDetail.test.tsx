import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { BillDetail } from './BillDetail';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'bill-001' }) };
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
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
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
});
