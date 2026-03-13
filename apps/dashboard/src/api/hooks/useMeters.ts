import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

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

export function useMeters(params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['meters', params],
    queryFn: () => api<PaginatedResult<Meter>>(`/meters?${qs}`),
  });
}

export function useMeter(id: string) {
  return useQuery({
    queryKey: ['meters', id],
    queryFn: () => api<Meter>(`/meters/${id}`),
    enabled: !!id,
  });
}

export function useDeleteMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/meters/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meters'] }); toast.success('Meter deleted'); },
    onError: (e) => { toast.error(e.message); },
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

export function useUpdateMeter(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ name: string; stateCode: string; siteId: string | null; tariffId: string | null; meterType: string | null }>) =>
      api<Meter>(`/meters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meters'] }); toast.success('Meter updated'); },
    onError: (e) => { toast.error(e.message); },
  });
}
