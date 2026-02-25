import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

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

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => api<Agent[]>('/agents'),
    refetchInterval: 30_000,
  });
}
