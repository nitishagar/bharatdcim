import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCreateTariff } from './useTariffs';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCreateTariff', () => {
  const input = {
    stateCode: 'KA',
    discom: 'BESCOM',
    category: 'HT',
    baseEnergyRatePaisa: 700,
    effectiveFrom: '2026-01-01',
  };

  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateTariff(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Tariff created');
  });

  it('calls toast.error on API failure', async () => {
    server.use(
      http.post('*/tariffs', () =>
        HttpResponse.json({ error: { message: 'Tariff already exists for this period' } }, { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useCreateTariff(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Tariff already exists for this period');
  });
});
