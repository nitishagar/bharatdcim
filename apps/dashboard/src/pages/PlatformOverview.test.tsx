import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { PlatformOverview } from './PlatformOverview';

describe('PlatformOverview page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/platform/overview', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<PlatformOverview />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders overview cards on data load', async () => {
    renderWithProviders(<PlatformOverview />);
    await waitFor(() =>
      expect(screen.getByText('Platform Overview')).toBeInTheDocument(),
    );
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Meters')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/platform/overview', () =>
        HttpResponse.json({ error: { message: 'Platform data unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<PlatformOverview />);
    await waitFor(() =>
      expect(screen.getByText('Platform data unavailable')).toBeInTheDocument(),
    );
  });
});
