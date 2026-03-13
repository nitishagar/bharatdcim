import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useUploadCSV } from './useUploads';

vi.mock('sonner');

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useUploadCSV', () => {
  it('calls toast.success on successful upload', async () => {
    const file = new File(['meter_id,kwh\nmeter-001,100'], 'readings.csv', { type: 'text/csv' });
    const { result } = renderHook(() => useUploadCSV(), { wrapper });
    await act(async () => { result.current.mutate({ file }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith('CSV uploaded successfully');
  });

  it('calls toast.error on upload failure', async () => {
    server.use(
      http.post('*/uploads/csv', () =>
        HttpResponse.json({ error: { message: 'Invalid CSV format' } }, { status: 400 }),
      ),
    );
    const file = new File(['bad data'], 'bad.csv', { type: 'text/csv' });
    const { result } = renderHook(() => useUploadCSV(), { wrapper });
    await act(async () => { result.current.mutate({ file }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith('Invalid CSV format');
  });
});
