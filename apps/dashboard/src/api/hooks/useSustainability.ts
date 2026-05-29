import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

export interface Rec {
  id: string;
  tenantId: string;
  certificateType: 'REC' | 'I-REC';
  serialNumber: string;
  source: 'solar' | 'wind' | 'hydro' | 'other';
  mwh: number;
  vintagePeriodStart: string;
  vintagePeriodEnd: string;
  status: 'active' | 'retired';
  retiredAt: string | null;
  retiredAgainstPeriod: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarbonEmission {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  gridEmissionFactorGPerKwh: number;
  totalKwh: number;
  renewableKwh: number;
  recOffsetKwh: number;
  scope2GrossKg: number;
  scope2NetKg: number;
  createdAt: string;
  updatedAt: string;
}

export function useRecs(params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['sustainability', 'recs', params],
    queryFn: () => api<PaginatedResult<Rec>>(`/sustainability/recs?${qs}`),
  });
}

export function useCreateRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api<Rec>('/sustainability/recs', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sustainability', 'recs'] }); toast.success('REC certificate added'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useRetireRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, retiredAgainstPeriod }: { id: string; retiredAgainstPeriod?: string }) =>
      api<Rec>(`/sustainability/recs/${id}/retire`, {
        method: 'POST',
        body: JSON.stringify({ retiredAgainstPeriod }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sustainability', 'recs'] }); toast.success('REC certificate retired'); },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useEmissions(params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['sustainability', 'emissions', params],
    queryFn: () => api<PaginatedResult<CarbonEmission>>(`/sustainability/emissions?${qs}`),
  });
}

export function useComputeEmissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { periodStart: string; periodEnd: string; gridEmissionFactorGPerKwh?: number }) =>
      api<CarbonEmission>('/sustainability/emissions/compute', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sustainability', 'emissions'] }); toast.success('Emissions computed'); },
    onError: (e) => { toast.error(e.message); },
  });
}
