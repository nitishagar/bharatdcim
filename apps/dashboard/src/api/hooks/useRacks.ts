import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

export interface Rack {
  id: string;
  tenantId: string;
  siteId: string | null;
  name: string;
  location: string | null;
  capacityU: number;
  status: string;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useRacks(params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['racks', params],
    queryFn: () => api<PaginatedResult<Rack>>(`/racks?${qs}`),
  });
}

export function useRack(id: string) {
  return useQuery({
    queryKey: ['racks', id],
    queryFn: () => api<Rack>(`/racks/${id}`),
    enabled: !!id,
  });
}

export function useCreateRack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name: string; siteId?: string; location?: string; capacityU?: number; metadata?: string }) =>
      api<Rack>('/racks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('Rack created'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateRack(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ name: string; siteId: string | null; location: string | null; capacityU: number; metadata: string | null }>) =>
      api<Rack>(`/racks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('Rack updated'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useDeleteRack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/racks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['racks'] }); toast.success('Rack deleted'); },
    onError: (e) => { toast.error(e.message); },
  });
}
