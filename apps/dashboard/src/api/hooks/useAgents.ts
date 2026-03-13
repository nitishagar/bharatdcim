import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

export interface Agent {
  id: string;
  agentId: string;
  agentVersion: string | null;
  deviceCount: number;
  unsyncedCount: number | null;
  status: string;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
}

export function useAgents(params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => api<PaginatedResult<Agent>>(`/agents?${qs}`),
    refetchInterval: 30_000,
  });
}
