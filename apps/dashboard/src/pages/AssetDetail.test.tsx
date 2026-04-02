import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach } from 'vitest';
import { useAuth } from '@clerk/clerk-react';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { mockAsset } from '../test/mocks/data';
import { AssetDetail } from './AssetDetail';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'asset-001' }), useNavigate: () => mockNavigate };
});

afterEach(() => {
  // Restore default useAuth mock after any per-test overrides
  vi.mocked(useAuth).mockReset();
  vi.mocked(useAuth).mockImplementation(() => ({
    orgRole: 'org:admin',
    isSignedIn: true,
    getToken: vi.fn(() => Promise.resolve('mock-test-token')),
    sessionClaims: { platformAdmin: false },
  } as unknown as ReturnType<typeof useAuth>));
});

describe('AssetDetail page', () => {
  it('renders loading skeleton initially', () => {
    server.use(
      http.get('*/assets/:id', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(mockAsset);
      }),
    );
    renderWithProviders(<AssetDetail />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders asset details on data load', async () => {
    renderWithProviders(<AssetDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dell PowerEdge R750' })).toBeInTheDocument());
    expect(screen.getByText('server')).toBeInTheDocument();
    expect(screen.getByText('Dell')).toBeInTheDocument();
    expect(screen.getByText('PowerEdge R750')).toBeInTheDocument();
    expect(screen.getByText('SN-001')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Row A Rack 01')).toBeInTheDocument());
  });

  it('renders error message on API failure', async () => {
    server.use(
      http.get('*/assets/:id', () =>
        HttpResponse.json({ error: { message: 'Asset not found' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<AssetDetail />);
    await waitFor(() => expect(screen.getByText('Asset not found')).toBeInTheDocument());
  });

  it('shows Delete Asset button for admin and completes delete flow', async () => {
    let deleted = false;
    server.use(
      http.delete('*/assets/:id', () => { deleted = true; return new HttpResponse(null, { status: 204 }); }),
    );
    renderWithProviders(<AssetDetail />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Asset' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Delete Asset' }));
    expect(screen.getByText('Delete Asset?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/assets'));
  });

  it('hides Delete Asset button for non-admin', async () => {
    vi.mocked(useAuth).mockReturnValue({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as unknown as ReturnType<typeof useAuth>);
    renderWithProviders(<AssetDetail />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dell PowerEdge R750' })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Asset' })).not.toBeInTheDocument());
  });
});
