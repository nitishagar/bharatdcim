import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCreateRack, useUpdateRack, useDeleteRack } from './useRacks';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCreateRack', () => {
  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateRack(), { wrapper });
    await act(async () => { result.current.mutate({ id: 'rack-new', name: 'New Rack' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Rack created');
  });

  it('calls toast.error on API failure', async () => {
    server.use(http.post('*/racks', () => HttpResponse.json({ error: { message: 'Duplicate rack ID' } }, { status: 409 })));
    const { result } = renderHook(() => useCreateRack(), { wrapper });
    await act(async () => { result.current.mutate({ id: 'rack-dup', name: 'Dup' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Duplicate rack ID');
  });
});

describe('useUpdateRack', () => {
  it('calls toast.success on update', async () => {
    const { result } = renderHook(() => useUpdateRack('rack-001'), { wrapper });
    await act(async () => { result.current.mutate({ name: 'Updated Rack' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Rack updated');
  });
});

describe('useDeleteRack', () => {
  it('calls toast.success on delete', async () => {
    const { result } = renderHook(() => useDeleteRack(), { wrapper });
    await act(async () => { result.current.mutate('rack-001'); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Rack deleted');
  });
});
