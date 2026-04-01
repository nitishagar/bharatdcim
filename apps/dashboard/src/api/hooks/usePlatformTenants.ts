import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';

export interface Tenant {
  id: string;
  name: string;
  stateCode: string;
  gstin: string | null;
  billingAddress: string | null;
  legalName: string | null;
  address1: string | null;
  city: string | null;
  pincode: string | null;
  createdAt: string;
  updatedAt: string;
}

export function usePlatformTenants() {
  return useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => api<Tenant[]>('/platform/tenants'),
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; stateCode: string; gstin?: string; billingAddress?: string }) =>
      api<Tenant>('/platform/tenants', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      toast.success('Tenant created');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; stateCode?: string; gstin?: string; billingAddress?: string; legalName?: string; address1?: string; city?: string; pincode?: string }) =>
      api<Tenant>(`/platform/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      toast.success('Tenant updated');
    },
    onError: (e) => { toast.error(e.message); },
  });
}
