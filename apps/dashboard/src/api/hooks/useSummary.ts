import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface Summary {
  meters: { total: number };
  bills: { total: number; totalAmountPaisa: number; totalKwh: number };
  invoices: { total: number };
  agents: { total: number; online: number };
}

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api<Summary>('/dashboard/summary'),
  });
}
