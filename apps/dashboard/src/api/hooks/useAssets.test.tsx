import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCreateAsset, useUpdateAsset, useDeleteAsset } from './useAssets';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCreateAsset', () => {
  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateAsset(), { wrapper });
    await act(async () => { result.current.mutate({ id: 'asset-new', name: 'New Asset', assetType: 'server' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Asset created');
  });

  it('calls toast.error on API failure', async () => {
    server.use(http.post('*/assets', () => HttpResponse.json({ error: { message: 'Duplicate asset ID' } }, { status: 409 })));
    const { result } = renderHook(() => useCreateAsset(), { wrapper });
    await act(async () => { result.current.mutate({ id: 'asset-dup', name: 'Dup', assetType: 'server' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Duplicate asset ID');
  });
});

describe('useUpdateAsset', () => {
  it('calls toast.success on update', async () => {
    const { result } = renderHook(() => useUpdateAsset('asset-001'), { wrapper });
    await act(async () => { result.current.mutate({ name: 'Updated Asset' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Asset updated');
  });
});

describe('useDeleteAsset', () => {
  it('calls toast.success on delete', async () => {
    const { result } = renderHook(() => useDeleteAsset(), { wrapper });
    await act(async () => { result.current.mutate('asset-001'); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Asset deleted');
  });
});
