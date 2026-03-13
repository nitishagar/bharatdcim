import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCalculateBill, useSaveBill } from './useBills';
import { mockBill } from '../../test/mocks/data';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ─── useCalculateBill ─────────────────────────────────────────────────────

describe('useCalculateBill', () => {
  const input = {
    readings: [{ kWh: 600, slotType: 'normal', ratePaisa: 700 }],
    tariff: { id: 'tariff-001' },
  };

  it('calls toast.success on successful calculation', async () => {
    const { result } = renderHook(() => useCalculateBill(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Bill calculated');
  });

  it('calls toast.error on API failure', async () => {
    server.use(
      http.post('*/bills/calculate', () =>
        HttpResponse.json({ error: { message: 'Invalid tariff' } }, { status: 422 }),
      ),
    );
    const { result } = renderHook(() => useCalculateBill(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Invalid tariff');
  });
});

// ─── useSaveBill ──────────────────────────────────────────────────────────

describe('useSaveBill', () => {
  const input = {
    meterId: 'meter-001',
    tariffId: 'tariff-001',
    billingPeriodStart: '2026-01-01',
    billingPeriodEnd: '2026-01-31',
    peakKwh: 200,
    normalKwh: 600,
    offPeakKwh: 200,
  };

  it('calls toast.success and invalidates bills query on success', async () => {
    const { result } = renderHook(() => useSaveBill(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Bill saved');
    expect(result.current.data).toMatchObject({ id: mockBill.id });
  });

  it('calls toast.error on API failure', async () => {
    server.use(
      http.post('*/bills', () =>
        HttpResponse.json({ error: { message: 'Meter not found' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useSaveBill(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Meter not found');
  });
});
