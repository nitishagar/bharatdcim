import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Uploads } from './Uploads';

describe('Uploads page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/uploads', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<Uploads />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders upload list and admin button on data load', async () => {
    renderWithProviders(<Uploads />);
    await waitFor(() => expect(screen.getByText('Uploads')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByText('readings-jan.csv')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Upload CSV' })).toBeInTheDocument();
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/uploads', () =>
        HttpResponse.json({ error: { message: 'Upload service error' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Uploads />);
    await waitFor(() =>
      expect(screen.getByText('Upload service error')).toBeInTheDocument(),
    );
  });

  it('renders empty state when no uploads', async () => {
    server.use(http.get('*/uploads', () => HttpResponse.json([])));
    renderWithProviders(<Uploads />);
    await waitFor(() => expect(screen.getByText('No uploads found')).toBeInTheDocument());
  });
});
