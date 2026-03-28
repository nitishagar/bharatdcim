import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Assets } from './Assets';

const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };

describe('Assets page', () => {
  it('renders loading skeleton initially', () => {
    server.use(
      http.get('*/assets', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<Assets />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders assets list on data load', async () => {
    renderWithProviders(<Assets />);
    await waitFor(() => expect(screen.getByText('Assets')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Dell PowerEdge R750')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add Asset' })).toBeInTheDocument();
  });

  it('renders empty state when no assets', async () => {
    server.use(http.get('*/assets', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<Assets />);
    await waitFor(() => expect(screen.getByText('No assets found')).toBeInTheDocument());
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/assets', () =>
        HttpResponse.json({ error: { message: 'Assets unavailable' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Assets />);
    await waitFor(() => expect(screen.getByText('Assets unavailable')).toBeInTheDocument());
  });
});

describe('Assets page – Add Asset form', () => {
  it('shows form when Add Asset button is clicked', async () => {
    renderWithProviders(<Assets />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Asset' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add Asset' }));
    expect(screen.getByPlaceholderText('e.g., Dell PowerEdge R750')).toBeInTheDocument();
  });

  it('hides form when Cancel is clicked', async () => {
    renderWithProviders(<Assets />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add Asset' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add Asset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByPlaceholderText('e.g., Dell PowerEdge R750')).not.toBeInTheDocument();
  });
});
