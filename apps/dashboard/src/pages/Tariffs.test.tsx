import { screen, waitFor, fireEvent } from '@testing-library/react';
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
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
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

  it('renders Edit Tariff button in expanded row when admin', async () => {
    renderWithProviders(<Tariffs />);
    await waitFor(() => expect(screen.getByText('BESCOM')).toBeInTheDocument());
    // Click the tariff row to expand it
    fireEvent.click(screen.getByText('BESCOM'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /edit tariff/i })).toBeInTheDocument(),
    );
  });

  it('shows Delete Tariff button in expanded view and opens confirm dialog', async () => {
    renderWithProviders(<Tariffs />);
    await waitFor(() => expect(screen.getByText('BESCOM')).toBeInTheDocument());
    // Click the row to expand it
    fireEvent.click(screen.getByText('BESCOM'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Tariff' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tariff' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls DELETE API on confirm delete tariff', async () => {
    let deleted = false;
    server.use(http.delete('*/tariffs/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    renderWithProviders(<Tariffs />);
    await waitFor(() => expect(screen.getByText('BESCOM')).toBeInTheDocument());
    fireEvent.click(screen.getByText('BESCOM'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Tariff' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Tariff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
  });
});
