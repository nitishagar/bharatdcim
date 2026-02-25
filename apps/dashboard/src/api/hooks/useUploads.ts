import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, uploadCSV } from '../client';

export interface Upload {
  id: string;
  tenantId: string;
  fileName: string;
  fileSize: number;
  format: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorsJson: string | null;
  metersAffected: string | null;
  processingTimeMs: number;
  createdAt: string;
}

export function useUploads() {
  return useQuery({
    queryKey: ['uploads'],
    queryFn: () => api<Upload[]>('/uploads'),
  });
}

export function useUpload(id: string) {
  return useQuery({
    queryKey: ['uploads', id],
    queryFn: () => api<Upload>(`/uploads/${id}`),
    enabled: !!id,
  });
}

export function useUploadCSV() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, tenantId }: { file: File; tenantId: string }) =>
      uploadCSV(file, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['meters'] });
    },
  });
}
