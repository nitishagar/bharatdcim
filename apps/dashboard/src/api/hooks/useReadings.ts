import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

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

export function useReadings(meterId: string, from?: string, to?: string) {
  const params = new URLSearchParams({ meter_id: meterId });
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  return useQuery({
    queryKey: ['readings', meterId, from, to],
    queryFn: () => api<Reading[]>(`/readings?${params}`),
    enabled: !!meterId,
  });
}
