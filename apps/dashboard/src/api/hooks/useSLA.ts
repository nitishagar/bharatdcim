import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

export interface SLAConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'uptime' | 'pue' | 'power_availability' | 'response_time';
  targetBps: number;
  measurementWindow: 'daily' | 'weekly' | 'monthly';
  meterId: string | null;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
  currentCompliance: number | null;
}

export interface SLAViolation {
  id: string;
  slaConfigId: string;
  tenantId: string;
  meterId: string | null;
  periodStart: string;
  periodEnd: string;
  targetBps: number;
  actualBps: number;
  gapBps: number;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export function useSLAConfigs() {
  return useQuery({
    queryKey: ['sla'],
    queryFn: () => api<SLAConfig[]>('/sla'),
  });
}

export function useSLADetail(id: string | undefined) {
  return useQuery({
    queryKey: ['sla', id],
    queryFn: () => api<SLAConfig>(`/sla/${id}`),
    enabled: !!id,
  });
}

export function useSLAViolations(id: string, params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['sla', id, 'violations', params],
    queryFn: () => api<PaginatedResult<SLAViolation>>(`/sla/${id}/violations?${qs}`),
    enabled: !!id,
  });
}

export function useCreateSLA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type: string; targetBps: number; measurementWindow?: string; meterId?: string }) =>
      api<SLAConfig>('/sla', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla'] });
      toast.success('SLA config created');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateSLA(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{ name: string; targetBps: number; measurementWindow: string; status: string }>) =>
      api<SLAConfig>(`/sla/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla'] });
      toast.success('SLA config updated');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useDeleteSLA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/sla/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla'] });
      toast.success('SLA config deleted');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateViolation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' }) =>
      api<SLAViolation>(`/sla/violations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sla'] });
      toast.success('Violation updated');
    },
    onError: (e) => { toast.error(e.message); },
  });
}
