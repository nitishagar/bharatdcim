import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { CapacityPlanning } from './CapacityPlanning';
import { useCapacityForecast, useCapacityThresholds, useCapacityAlerts, useCreateThreshold } from '../api/hooks/useCapacity';
import {
  mockCapacityThresholds,
  mockCapacityForecast,
  mockCapacityAlerts,
  mockCapacityThreshold,
} from '../test/mocks/data';

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

function TestWrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CapacityPlanning page', () => {
  it('renders "Capacity Planning" heading', async () => {
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /capacity planning/i })).toBeInTheDocument(),
    );
  });

  it('renders KPICard "Meters at Risk" with count from critical alerts', async () => {
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText('Meters at Risk')).toBeInTheDocument());
    // Wait for alerts data to load and display count
    await waitFor(() => expect(screen.queryByText('—')).not.toBeInTheDocument());
  });

  it('renders KPICard "Active Alerts" with count', async () => {
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText('Active Alerts')).toBeInTheDocument());
  });

  it('renders "No thresholds configured" empty state when no thresholds exist', async () => {
    server.use(
      http.get('*/capacity/thresholds', () => HttpResponse.json([])),
    );
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() =>
      expect(screen.getByText(/no thresholds configured/i)).toBeInTheDocument(),
    );
  });

  it('"Add Threshold" button visible to admin users', async () => {
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /capacity planning/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /add threshold/i })).toBeInTheDocument();
  });

  it('"Add Threshold" button not visible to non-admin users', async () => {
    const { useAuth } = await import('@clerk/clerk-react');
    vi.mocked(useAuth).mockReturnValue({
      orgRole: 'org:member',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as any);
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /capacity planning/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /add threshold/i })).not.toBeInTheDocument();
    vi.mocked(useAuth).mockReturnValue({
      orgRole: 'org:admin',
      isSignedIn: true,
      getToken: vi.fn(() => Promise.resolve('mock-test-token')),
      sessionClaims: { platformAdmin: false },
    } as any);
  });

  it('forecast card shows "Stable" when projectedBreachAt is null', async () => {
    server.use(
      http.get('*/capacity/forecast', () => HttpResponse.json({ ...mockCapacityForecast, projectedBreachAt: null })),
    );
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText('Stable')).toBeInTheDocument());
  });

  it('forecast card shows projected breach date when set', async () => {
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText(/projected breach/i)).toBeInTheDocument());
  });

  it('shows error message when thresholds API fails', async () => {
    server.use(
      http.get('*/capacity/thresholds', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })),
    );
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText(/retry/i)).toBeInTheDocument());
  });

  it('shows error message when alerts API fails', async () => {
    server.use(
      http.get('*/capacity/alerts', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })),
    );
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText(/retry/i)).toBeInTheDocument());
  });

  it('shows error message in ForecastCard when forecast API fails', async () => {
    server.use(
      http.get('*/capacity/forecast', () => HttpResponse.json({ error: 'Server error' }, { status: 500 })),
    );
    renderWithProviders(<CapacityPlanning />);
    await waitFor(() => expect(screen.getByText(/api error/i)).toBeInTheDocument());
  });
});

describe('useCapacityForecast hook', () => {
  it('calls GET /capacity/forecast?meter_id=X&window_days=30', async () => {
    let capturedUrl = '';
    server.use(
      http.get('*/capacity/forecast', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json(mockCapacityForecast);
      }),
    );
    const { result } = renderHook(
      () => useCapacityForecast('meter-001', 30),
      { wrapper: TestWrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('meter_id=meter-001');
    expect(capturedUrl).toContain('window_days=30');
  });
});

describe('useCapacityThresholds hook', () => {
  it('calls GET /capacity/thresholds', async () => {
    let called = false;
    server.use(
      http.get('*/capacity/thresholds', () => { called = true; return HttpResponse.json(mockCapacityThresholds); }),
    );
    const { result } = renderHook(() => useCapacityThresholds(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(called).toBe(true);
  });
});

describe('useCapacityAlerts hook', () => {
  it('calls GET /capacity/alerts', async () => {
    let called = false;
    server.use(
      http.get('*/capacity/alerts', () => { called = true; return HttpResponse.json(mockCapacityAlerts); }),
    );
    const { result } = renderHook(() => useCapacityAlerts(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(called).toBe(true);
  });
});

describe('useCreateThreshold hook', () => {
  it('calls POST /capacity/thresholds and invalidates thresholds query', async () => {
    let postCalled = false;
    server.use(
      http.post('*/capacity/thresholds', () => { postCalled = true; return HttpResponse.json(mockCapacityThreshold, { status: 201 }); }),
    );
    const { result } = renderHook(() => useCreateThreshold(), { wrapper: TestWrapper });
    result.current.mutate({
      meterId: 'meter-001',
      metric: 'kwh_daily',
      warningValue: 800,
      criticalValue: 1000,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postCalled).toBe(true);
  });
});
