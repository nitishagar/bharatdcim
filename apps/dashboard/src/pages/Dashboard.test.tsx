import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Dashboard } from './Dashboard';

describe('Dashboard page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/dashboard/summary', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({
          meters: { total: 3 },
          bills: { total: 5, totalAmountPaisa: 500000, totalKwh: 1250 },
          invoices: { total: 2 },
          agents: { total: 1, online: 1 },
        });
      }),
    );
    renderWithProviders(<Dashboard />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders KPI cards and quick action links on data load', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Overview')).toBeInTheDocument());
    expect(screen.getByText('Total Meters')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Calculate Bill')).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/dashboard/summary', () =>
        HttpResponse.json({ error: { message: 'Service unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('Service unavailable')).toBeInTheDocument(),
    );
  });
});
