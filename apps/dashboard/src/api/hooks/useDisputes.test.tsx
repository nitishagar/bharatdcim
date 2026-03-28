import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useCreateDispute } from './useDisputes';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useCreateDispute', () => {
  it('calls toast.success on success', async () => {
    const { result } = renderHook(() => useCreateDispute('bill-001'), { wrapper });
    await act(async () => { result.current.mutate({ reason: 'Incorrect reading' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('Dispute submitted');
  });

  it('calls toast.error on API failure', async () => {
    server.use(http.post('*/bills/*/dispute', () => HttpResponse.json({ error: { message: 'Bill not found' } }, { status: 404 })));
    const { result } = renderHook(() => useCreateDispute('bill-999'), { wrapper });
    await act(async () => { result.current.mutate({ reason: 'Test' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Bill not found');
  });
});
