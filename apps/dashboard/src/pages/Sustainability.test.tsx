import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { Sustainability } from './Sustainability';

const emptyPage = { data: [], total: 0, limit: 25, offset: 0 };

vi.mock('@clerk/clerk-react', async () => {
  const actual = await vi.importActual('@clerk/clerk-react');
  return {
    ...(actual as object),
    useAuth: vi.fn(() => ({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    })),
  };
});

describe('Sustainability page', () => {
  it('renders loading skeleton initially', () => {
    server.use(
      http.get('*/sustainability/recs', async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(emptyPage);
      }),
    );
    renderWithProviders(<Sustainability />);
    expect(document.querySelector('[data-testid="loading-skeleton"]')).toBeInTheDocument();
  });

  it('renders REC Certificates heading', async () => {
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('REC Certificates')).toBeInTheDocument());
  });

  it('renders Scope-2 Emissions heading', async () => {
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('Scope-2 Emissions')).toBeInTheDocument());
  });

  it('renders REC table with serial number', async () => {
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('IN-REC-2026-001')).toBeInTheDocument());
  });

  it('renders Scope-2 KPI cards when emissions data is present', async () => {
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByTestId('scope2-summary')).toBeInTheDocument());
    expect(screen.getByText('Scope-2 Gross (latest period)')).toBeInTheDocument();
    expect(screen.getByText('Scope-2 Net (latest period)')).toBeInTheDocument();
    expect(screen.getByText('REC Offset (latest period)')).toBeInTheDocument();
  });

  it('"Add REC" button visible to admin users', async () => {
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('REC Certificates')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add rec/i })).toBeInTheDocument();
  });

  it('"Add REC" button not visible to non-admin users', async () => {
    const { useAuth } = await import('@clerk/clerk-react');
    vi.mocked(useAuth).mockReturnValueOnce({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as ReturnType<typeof useAuth>);

    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('REC Certificates')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /add rec/i })).not.toBeInTheDocument();
  });

  it('"Compute Emissions" button visible to admin users', async () => {
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('Scope-2 Emissions')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /compute emissions/i })).toBeInTheDocument();
  });

  it('renders empty state when no RECs', async () => {
    server.use(http.get('*/sustainability/recs', () => HttpResponse.json(emptyPage)));
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('No REC certificates')).toBeInTheDocument());
  });

  it('renders error state on API failure', async () => {
    server.use(
      http.get('*/sustainability/recs', () =>
        HttpResponse.json({ error: { message: 'Internal server error' } }, { status: 500 }),
      ),
    );
    renderWithProviders(<Sustainability />);
    await waitFor(() => expect(screen.getByText('Internal server error')).toBeInTheDocument());
  });
});
