import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Meters } from './Meters';

describe('Meters page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/meters', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Meters />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders meter list on data load', async () => {
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByText('Meters')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Main Grid Meter')).toBeInTheDocument());
    // Admin button visible since useIsAdmin returns true by default
    expect(screen.getByRole('button', { name: 'Create Meter' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/meters', () =>
        HttpResponse.json({ error: { message: 'Meters unavailable' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Meters />);
    await waitFor(() =>
      expect(screen.getByText('Meters unavailable')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no meters', async () => {
    server.use(http.get('*/meters', () => HttpResponse.json([])));
    renderWithProviders(<Meters />);
    await waitFor(() => expect(screen.getByText('No meters found')).toBeInTheDocument());
  });
});
