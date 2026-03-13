import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCreateMeter, useUpdateMeter } from './useMeters';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCreateMeter', () => {
  const input = { id: 'meter-new', name: 'New Meter', stateCode: 'MH' };

  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateMeter(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Meter created');
  });

  it('calls toast.error on API failure', async () => {
    server.use(
      http.post('*/meters', () =>
        HttpResponse.json({ error: { message: 'Duplicate meter ID' } }, { status: 409 }),
      ),
    );
    const { result } = renderHook(() => useCreateMeter(), { wrapper });
    await act(async () => { result.current.mutate(input); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Duplicate meter ID');
  });
});

describe('useUpdateMeter', () => {
  it('calls toast.success on successful update', async () => {
    const { result } = renderHook(() => useUpdateMeter('meter-001'), { wrapper });
    await act(async () => { result.current.mutate({ name: 'Updated Name' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Meter updated');
  });

  it('calls toast.error on API failure', async () => {
    server.use(
      http.patch('*/meters/:id', () =>
        HttpResponse.json({ error: { message: 'Meter not found' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useUpdateMeter('meter-001'), { wrapper });
    await act(async () => { result.current.mutate({ name: 'Updated' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Meter not found');
  });
});
