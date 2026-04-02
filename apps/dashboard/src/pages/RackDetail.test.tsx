import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { mockRack } from '../test/mocks/data';
import { RackDetail } from './RackDetail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'rack-001' }), useNavigate: () => mockNavigate };
});

afterEach(() => {
  vi.mocked(useAuth).mockReset();
  vi.mocked(useAuth).mockImplementation(() => ({
    orgRole: 'org:admin',
    isSignedIn: true,
    getToken: vi.fn(() => Promise.resolve('mock-test-token')),
    sessionClaims: { platformAdmin: false },
  }));
});

const emptyPage = { data: [], total: 0, limit: 100, offset: 0 };

describe('RackDetail page', () => {
  it('renders loading skeleton initially', () => {
    server.use(
      http.get('*/racks/:id', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(mockRack);
      }),
    );
    renderWithProviders(<RackDetail />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders rack details on data load', async () => {
    renderWithProviders(<RackDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Row A Rack 01' })).toBeInTheDocument());
    expect(screen.getByText('Floor 1, Row A')).toBeInTheDocument();
    expect(screen.getByText('42U')).toBeInTheDocument();
    expect(screen.getAllByText('active').length).toBeGreaterThan(0);
  });

  it('renders assets table with asset data', async () => {
    renderWithProviders(<RackDetail />);
    await waitFor(() => expect(screen.getByText('Dell PowerEdge R750')).toBeInTheDocument());
  });

  it('navigates to asset detail on row click', async () => {
    renderWithProviders(<RackDetail />);
    await waitFor(() => expect(screen.getByText('Dell PowerEdge R750')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Dell PowerEdge R750'));
    expect(mockNavigate).toHaveBeenCalledWith('/assets/asset-001');
  });

  it('shows Delete Rack button for admin and completes delete flow', async () => {
    let deleted = false;
    server.use(
      http.delete('*/racks/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
    );
    renderWithProviders(<RackDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Rack' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rack' }));
    expect(screen.getByText('Delete Rack?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/racks'));
  });

  it('renders empty state when no assets in rack', async () => {
    server.use(
      http.get('*/assets', () => HttpResponse.json(emptyPage)),
    );
    renderWithProviders(<RackDetail />);
    await waitFor(() => expect(screen.getByText('No assets in this rack')).toBeInTheDocument());
  });
});
