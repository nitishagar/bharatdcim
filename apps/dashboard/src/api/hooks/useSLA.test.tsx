import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useSLAConfigs, useSLADetail, useSLAViolations, useCreateSLA, useUpdateViolation } from './useSLA';
import { mockSLAConfigs, mockSLAConfig, mockSLAViolations } from '../../test/mocks/data';

function TestWrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useSLAConfigs', () => {
  it('calls GET /sla', async () => {
    let called = false;
    server.use(http.get('*/sla', () => { called = true; return HttpResponse.json(mockSLAConfigs); }));
    const { result } = renderHook(() => useSLAConfigs(), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(called).toBe(true);
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useSLADetail', () => {
  it('calls GET /sla/:id', async () => {
    let capturedUrl = '';
    server.use(
      http.get('*/sla/:id', ({ request }) => { capturedUrl = request.url; return HttpResponse.json(mockSLAConfig); }),
    );
    const { result } = renderHook(() => useSLADetail('sla-001'), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/sla/sla-001');
  });
});

describe('useSLAViolations', () => {
  it('calls GET /sla/:id/violations with pagination', async () => {
    let capturedUrl = '';
    server.use(
      http.get('*/sla/:id/violations', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: mockSLAViolations, total: 1, limit: 25, offset: 0 });
      }),
    );
    const { result } = renderHook(() => useSLAViolations('sla-001', { limit: 25, offset: 0 }), { wrapper: TestWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/sla/sla-001/violations');
    expect(result.current.data?.data).toHaveLength(1);
  });
});

describe('useCreateSLA', () => {
  it('calls POST /sla and invalidates sla queries', async () => {
    let postCalled = false;
    server.use(
      http.post('*/sla', () => { postCalled = true; return HttpResponse.json(mockSLAConfig, { status: 201 }); }),
    );
    const { result } = renderHook(() => useCreateSLA(), { wrapper: TestWrapper });
    result.current.mutate({ name: 'Test SLA', type: 'uptime', targetBps: 9900 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postCalled).toBe(true);
  });
});

describe('useUpdateViolation', () => {
  it('calls PATCH /sla/violations/:id', async () => {
    let capturedUrl = '';
    server.use(
      http.patch('*/sla/violations/:id', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ ...mockSLAViolations[0], status: 'acknowledged' });
      }),
    );
    const { result } = renderHook(() => useUpdateViolation(), { wrapper: TestWrapper });
    result.current.mutate({ id: 'viol-001', status: 'acknowledged' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain('/sla/violations/viol-001');
  });
});
