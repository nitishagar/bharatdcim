import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Racks } from './Racks';

const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };

describe('Racks page', () => {
  it('renders loading skeleton initially', () => {
    server.use(
      http.get('*/racks', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<Racks />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders racks list on data load', async () => {
    renderWithProviders(<Racks />);
    await waitFor(() => expect(screen.getByText('Racks')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Row A Rack 01')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add Rack' })).toBeInTheDocument();
  });

  it('renders empty state when no racks', async () => {
    server.use(http.get('*/racks', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<Racks />);
    await waitFor(() => expect(screen.getByText('No racks found')).toBeInTheDocument());
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/racks', () =>
        HttpResponse.json({ error: { message: 'Racks unavailable' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Racks />);
    await waitFor(() => expect(screen.getByText('Racks unavailable')).toBeInTheDocument());
  });
});

describe('Racks page – Add Rack form', () => {
  it('shows form when Add Rack button is clicked', async () => {
    renderWithProviders(<Racks />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Rack' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add Rack' }));
    expect(screen.getByPlaceholderText('e.g., Row A Rack 01')).toBeInTheDocument();
  });

  it('hides form when Cancel is clicked', async () => {
    renderWithProviders(<Racks />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Rack' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add Rack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('e.g., Row A Rack 01')).not.toBeInTheDocument();
  });
});
