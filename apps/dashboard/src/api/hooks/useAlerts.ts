import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface AlertEvent {
  id: string;
  tenantId: string;
  ruleId: string;
  meterId: string;
  value: number;
  threshold: number;
  severity: string;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export function useActiveAlerts(meterId?: string) {
  const params = new URLSearchParams();
  if (meterId) params.set('meter_id', meterId);
  return useQuery({
    queryKey: ['alerts', 'active', meterId],
    queryFn: () => api<AlertEvent[]>(`/alerts${params.toString() ? `?${params}` : ''}`),
  });
}
