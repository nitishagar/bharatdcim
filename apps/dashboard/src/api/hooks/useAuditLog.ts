import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface AuditEntry {
  id: string;
  invoiceId: string;
  action: string;
  detailsJson: string | null;
  actor: string | null;
  createdAt: string;
}

export function useAuditLog(invoiceId: string) {
  return useQuery({
    queryKey: ['audit-log', invoiceId],
    queryFn: () => api<AuditEntry[]>(`/invoices/${invoiceId}/audit-log`),
    enabled: !!invoiceId,
  });
}
