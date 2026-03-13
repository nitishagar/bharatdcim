import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Invoices } from './Invoices';

describe('Invoices page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/invoices', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Invoices />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders invoice list and admin button on data load', async () => {
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByText('Invoices')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Generate Invoice' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/invoices', () =>
        HttpResponse.json({ error: { message: 'Invoices unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<Invoices />);
    await waitFor(() =>
      expect(screen.getByText('Invoices unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no invoices', async () => {
    server.use(http.get('*/invoices', () => HttpResponse.json([])));
    renderWithProviders(<Invoices />);
    await waitFor(() => expect(screen.getByText('No invoices found')).toBeInTheDocument());
  });
});
