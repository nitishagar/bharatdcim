import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { MeterDetail } from './MeterDetail';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'meter-001' }) };
});

describe('MeterDetail page', () => {
  it('renders loading spinner initially', () => {
    server.use(
      http.get('*/meters/:id', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<MeterDetail />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders meter details on data load', async () => {
    renderWithProviders(<MeterDetail />);
    // Heading and breadcrumb both render the name — use role to target h2
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    expect(screen.getByText('KA')).toBeInTheDocument();
    expect(screen.getByText('Readings')).toBeInTheDocument();
  });

  it('renders error message on meter fetch failure', async () => {
    server.use(
      http.get('*/meters/:id', () =>
        HttpResponse.json({ error: { message: 'Meter not found' } }, { status: 404 }),
      ),
    );
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByText('Meter not found')).toBeInTheDocument(),
    );
  });

  it('renders Edit Meter button when admin', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /edit meter/i })).toBeInTheDocument();
  });

  it('shows edit form when Edit Meter button is clicked', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /edit meter/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('hides edit form when Cancel is clicked', async () => {
    renderWithProviders(<MeterDetail />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Main Grid Meter' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /edit meter/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });
});
