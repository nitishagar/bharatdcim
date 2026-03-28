import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';

export interface Dispute {
  id: string;
  billId: string;
  tenantId: string;
  disputedBy: string;
  reason: string;
  status: 'open' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export function useDisputes(billId: string) {
  return useQuery({
    queryKey: ['disputes', billId],
    queryFn: () => api<Dispute[]>(`/bills/${billId}/disputes`),
    enabled: !!billId,
  });
}

export function useCreateDispute(billId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string }) =>
      api<Dispute>(`/bills/${billId}/dispute`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['disputes', billId] }); toast.success('Dispute submitted'); },
    onError: (e) => { toast.error(e.message); },
  });
}
