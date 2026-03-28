import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';

export interface CapacityThreshold {
  id: string;
  tenantId: string;
  meterId: string;
  metric: 'kwh_daily' | 'kw_peak' | 'kwh_monthly';
  warningValue: number;
  criticalValue: number;
  windowDays: number;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export interface DailyAggregate {
  date: string;
  totalKwh: number;
}

export interface CapacityForecast {
  dailyAggregates: DailyAggregate[];
  trendSlope: number;
  r2: number;
  projectedBreachAt: string | null;
  thresholds: CapacityThreshold[];
}

export interface CapacityAlert {
  id: string;
  tenantId: string;
  meterId: string | null;
  slaConfigId: string | null;
  type: string;
  metric: string;
  thresholdValue: number;
  currentValue: number;
  predictedBreachAt: string | null;
  severity: string;
  status: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useCapacityForecast(meterId: string | undefined, windowDays = 30) {
  return useQuery({
    queryKey: ['capacity', 'forecast', meterId, windowDays],
    queryFn: () => api<CapacityForecast>(`/capacity/forecast?meter_id=${meterId}&window_days=${windowDays}`),
    enabled: !!meterId,
  });
}

export function useCapacityThresholds(meterId?: string) {
  const query = meterId ? `?meter_id=${meterId}` : '';
  return useQuery({
    queryKey: ['capacity', 'thresholds', meterId],
    queryFn: () => api<CapacityThreshold[]>(`/capacity/thresholds${query}`),
  });
}

export function useCapacityAlerts(status?: string) {
  const query = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['capacity', 'alerts', status],
    queryFn: () => api<CapacityAlert[]>(`/capacity/alerts${query}`),
  });
}

export function useCreateThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { meterId: string; metric: string; warningValue: number; criticalValue: number; windowDays?: number }) =>
      api<CapacityThreshold>('/capacity/thresholds', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capacity'] });
      toast.success('Threshold created');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' }) =>
      api<CapacityAlert>(`/capacity/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capacity', 'alerts'] });
      toast.success('Alert updated');
    },
    onError: (e) => { toast.error(e.message); },
  });
}
