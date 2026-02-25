import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface Meter {
  id: string;
  tenantId: string;
  name: string;
  siteId: string | null;
  stateCode: string;
  tariffId: string | null;
  meterType: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useMeters() {
  return useQuery({
    queryKey: ['meters'],
    queryFn: () => api<Meter[]>('/meters'),
  });
}

export function useMeter(id: string) {
  return useQuery({
    queryKey: ['meters', id],
    queryFn: () => api<Meter>(`/meters/${id}`),
    enabled: !!id,
  });
}
