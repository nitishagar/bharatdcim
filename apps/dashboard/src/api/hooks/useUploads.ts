import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, uploadCSV } from '../client';
import { type PaginationParams, type PaginatedResult, buildPaginationQuery } from './types';

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

export function useUploads(params: PaginationParams = { limit: 25, offset: 0 }) {
  const qs = buildPaginationQuery(params);
  return useQuery({
    queryKey: ['uploads', params],
    queryFn: () => api<PaginatedResult<Upload>>(`/uploads?${qs}`),
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
    mutationFn: ({ file }: { file: File }) => uploadCSV(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] });
      queryClient.invalidateQueries({ queryKey: ['readings'] });
      queryClient.invalidateQueries({ queryKey: ['meters'] });
      toast.success('CSV uploaded successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
