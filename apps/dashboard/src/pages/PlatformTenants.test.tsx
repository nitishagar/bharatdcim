import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { PlatformTenants } from './PlatformTenants';

describe('PlatformTenants page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/platform/tenants', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<PlatformTenants />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders tenant list on data load', async () => {
    renderWithProviders(<PlatformTenants />);
    await waitFor(() => expect(screen.getByText('Tenants')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('DataCenter Corp')).toBeInTheDocument(),
    );
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/platform/tenants', () =>
        HttpResponse.json({ error: { message: 'Tenants unavailable' } }, { status: 503 }),
      ),
    );
    renderWithProviders(<PlatformTenants />);
    await waitFor(() =>
      expect(screen.getByText('Tenants unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no tenants', async () => {
    server.use(http.get('*/platform/tenants', () => HttpResponse.json([])));
    renderWithProviders(<PlatformTenants />);
    await waitFor(() =>
      expect(screen.getByText('No tenants found')).toBeInTheDocument(),
    );
  });
});
