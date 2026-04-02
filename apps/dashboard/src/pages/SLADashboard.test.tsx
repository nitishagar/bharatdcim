import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { SLADashboard } from './SLADashboard';

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

describe('SLADashboard page', () => {
  it('renders "SLA Management" heading', async () => {
    renderWithProviders(<SLADashboard />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sla management/i })).toBeInTheDocument(),
    );
  });

  it('renders KPICard "Active SLAs" with count', async () => {
    renderWithProviders(<SLADashboard />);
    await waitFor(() => expect(screen.getByText('Active SLAs')).toBeInTheDocument());
  });

  it('renders KPICard "Compliant" with percentage', async () => {
    renderWithProviders(<SLADashboard />);
    await waitFor(() => expect(screen.getByText('Compliant')).toBeInTheDocument());
  });

  it('renders KPICard "Open Violations" with count', async () => {
    renderWithProviders(<SLADashboard />);
    await waitFor(() => expect(screen.getByText('Open Violations')).toBeInTheDocument());
  });

  it('renders SLA config table with Name column', async () => {
    renderWithProviders(<SLADashboard />);
    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('"Create SLA" button visible to admin users', async () => {
    renderWithProviders(<SLADashboard />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sla management/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /create sla/i })).toBeInTheDocument();
  });

  it('"Create SLA" button not visible to non-admin users', async () => {
    const { useAuth } = await import('@clerk/clerk-react');
    vi.mocked(useAuth).mockReturnValue({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as any);
    renderWithProviders(<SLADashboard />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /sla management/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /create sla/i })).not.toBeInTheDocument();
    vi.mocked(useAuth).mockReturnValue({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as any);
  });

  it('empty state when no SLA configs exist', async () => {
    server.use(http.get('*/sla', () => HttpResponse.json([])));
    renderWithProviders(<SLADashboard />);
    await waitFor(() =>
      expect(screen.getByText(/no sla configs/i)).toBeInTheDocument(),
    );
  });

  it('shows error message with retry button on fetch failure', async () => {
    server.use(http.get('*/sla', () => HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })));
    renderWithProviders(<SLADashboard />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument(),
    );
  });
});
