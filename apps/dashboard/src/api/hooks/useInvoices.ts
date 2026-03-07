import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';

export interface Invoice {
  id: string;
  billId: string;
  tenantId: string;
  invoiceNumber: string;
  financialYear: string;
  supplierGstin: string;
  recipientGstin: string;
  taxType: string;
  taxableAmountPaisa: number;
  cgstPaisa: number | null;
  sgstPaisa: number | null;
  igstPaisa: number | null;
  totalTaxPaisa: number;
  totalAmountPaisa: number;
  status: string;
  invoiceDate: string;
  createdAt: string;
  updatedAt: string;
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<Invoice[]>('/invoices'),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => api<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { billId: string; supplierGSTIN: string; recipientGSTIN: string }) =>
      api<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Invoice created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api<unknown>(`/invoices/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice cancelled');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCreateCreditNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { invoiceId: string; amountPaisa: number; reason: string }) =>
      api<unknown>('/invoices/credit-notes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Credit note issued');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
