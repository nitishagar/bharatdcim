import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';

export interface NotificationConfig {
  id: string;
  tenantId: string;
  name: string;
  type: 'email' | 'webhook';
  destination: string;
  eventsJson: string;
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
}

export function useNotificationConfigs() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationConfig[]>('/notifications'),
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; type: string; destination: string; events: string[]; status?: string }) =>
      api<NotificationConfig>('/notifications', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification channel created');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useUpdateNotification(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<{ name: string; destination: string; events: string[]; status: string }>) =>
      api<NotificationConfig>(`/notifications/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification channel updated');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/notifications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notification channel deleted');
    },
    onError: (e) => { toast.error(e.message); },
  });
}

export function useTestNotification(id: string) {
  return useMutation({
    mutationFn: () => api<{ sent: boolean; type: string; destination: string }>(`/notifications/${id}/test`, { method: 'POST' }),
    onSuccess: () => { toast.success('Test notification sent'); },
    onError: (e) => { toast.error(e.message); },
  });
}
