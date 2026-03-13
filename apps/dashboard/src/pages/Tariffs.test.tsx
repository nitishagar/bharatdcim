import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Tariffs } from './Tariffs';

describe('Tariffs page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/tariffs', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Tariffs />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders tariff list and admin button on data load', async () => {
    renderWithProviders(<Tariffs />);
    await waitFor(() => expect(screen.getByText('Tariffs')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('BESCOM')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Create Tariff' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/tariffs', () =>
        HttpResponse.json({ error: { message: 'Tariff service error' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Tariffs />);
    await waitFor(() =>
      expect(screen.getByText('Tariff service error')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no tariffs', async () => {
    server.use(http.get('*/tariffs', () => HttpResponse.json([])));
    renderWithProviders(<Tariffs />);
    await waitFor(() =>
      expect(screen.getByText('No tariffs configured')).toBeInTheDocument(),
    );
  });
});
