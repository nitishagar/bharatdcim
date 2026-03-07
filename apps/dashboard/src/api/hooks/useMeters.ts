import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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

export function useCreateMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name: string; stateCode: string; siteId?: string; tariffId?: string; meterType?: string }) =>
      api<Meter>('/meters', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meters'] }); toast.success('Meter created'); },
    onError: (e) => { toast.error(e.message); },
  });
}
