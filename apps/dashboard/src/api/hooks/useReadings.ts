import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

export interface Reading {
  id: string;
  meterId: string;
  timestamp: string;
  kWh: number | null;
  kW: number | null;
  voltage: number | null;
  current: number | null;
  powerFactor: number | null;
  source: string | null;
  slotType: string | null;
  slotName: string | null;
  ratePaisa: number | null;
  uploadId: string | null;
  createdAt: string;
}

export function useReadings(
  meterId: string,
  from?: string,
  to?: string,
  pagination: PaginationParams = { limit: 25, offset: 0 },
) {
  const params = new URLSearchParams({ meter_id: meterId });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const paginationQs = buildPaginationQuery(pagination);
  paginationQs.forEach((v, k) => params.set(k, v));

  return useQuery({
    queryKey: ['readings', meterId, from, to, pagination],
    queryFn: () => api<PaginatedResult<Reading>>(`/readings?${params}`),
    enabled: !!meterId,
  });
}
