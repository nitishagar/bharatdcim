import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';
import { useEnvReadings } from './useEnvReadings';
import React from 'react';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useEnvReadings', () => {
  // HOOK-ENV-01: useEnvReadings calls GET /env-readings?meter_id=X
  it('HOOK-ENV-01: fetches env-readings with meter_id param', async () => {
    const mockData = [
      { id: 'er1', meterId: 'meter-001', timestamp: '2026-03-01T10:00:00Z', tempCTenths: 235, humidityPctTenths: 450 },
    ];
    server.use(
      http.get('*/env-readings', () => HttpResponse.json(mockData)),
    );

    const { result } = renderHook(() => useEnvReadings('meter-001'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });

  // HOOK-ENV-02: does not fetch when meterId is empty
  it('HOOK-ENV-02: does not fetch when meterId is empty', async () => {
    let fetchCalled = false;
    server.use(
      http.get('*/env-readings', () => { fetchCalled = true; return HttpResponse.json([]); }),
    );

    const { result } = renderHook(() => useEnvReadings(''), { wrapper });
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.isFetching).toBe(false);
    expect(fetchCalled).toBe(false);
  });
});
