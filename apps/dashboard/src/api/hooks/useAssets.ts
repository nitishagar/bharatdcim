import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

export type AssetType = 'server' | 'storage' | 'network' | 'pdu' | 'ups' | 'cooling' | 'other';

export interface Asset {
  id: string;
  tenantId: string;
  rackId: string | null;
  name: string;
  assetType: AssetType;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  rackUnitStart: number | null;
  rackUnitSize: number;
  status: string;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAssets(params: PaginationParams & { rackId?: string } = { limit: 25, offset: 0 }) {
  const { rackId, ...pagination } = params;
  const qs = buildPaginationQuery(pagination);
  const rackFilter = rackId ? `&rack_id=${rackId}` : '';
  return useQuery({
    queryKey: ['assets', params],
    queryFn: () => api<PaginatedResult<Asset>>(`/assets?${qs}${rackFilter}`),
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: ['assets', id],
    queryFn: () => api<Asset>(`/assets/${id}`),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; name: string; assetType: AssetType; rackId?: string; manufacturer?: string; model?: string; serialNumber?: string; rackUnitStart?: number; rackUnitSize?: number; metadata?: string }) =>
      api<Asset>('/assets', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset created'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateAsset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ name: string; assetType: AssetType; rackId: string | null; manufacturer: string | null; model: string | null; serialNumber: string | null; rackUnitStart: number | null; rackUnitSize: number; metadata: string | null }>) =>
      api<Asset>(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset updated'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast.success('Asset deleted'); },
    onError: (e) => { toast.error(e.message); },
  });
}
