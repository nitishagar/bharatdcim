import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface EnvReading {
  id: string;
  meterId: string;
  timestamp: string;
  tempCTenths: number | null;
  humidityPctTenths: number | null;
  source?: string | null;
}

export function useEnvReadings(meterId: string, from?: string, to?: string) {
  const params = new URLSearchParams({ meter_id: meterId });
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  return useQuery({
    queryKey: ['env-readings', meterId, from, to],
    queryFn: () => api<EnvReading[]>(`/env-readings?${params}`),
    enabled: !!meterId,
  });
}

export function useLatestEnvReading(meterId: string) {
  return useQuery({
    queryKey: ['env-readings', 'latest', meterId],
    queryFn: async () => {
      const results = await api<EnvReading[]>('/env-readings/latest');
      return results.find((r) => r.meterId === meterId) ?? null;
    },
    enabled: !!meterId,
  });
}
