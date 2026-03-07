import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';

interface Tenant {
  id: string;
  name: string;
  stateCode: string;
  gstin: string | null;
  createdAt: string;
}

const columns: ColumnDef<Tenant, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'stateCode', header: 'State' },
  { id: 'gstin', header: 'GSTIN', accessorFn: (t) => t.gstin ?? '—' },
  { id: 'created', header: 'Created', accessorFn: (t) => t.createdAt, cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('en-IN') },
];

export function PlatformTenants() {
  const { data, isLoading, error, refetch } = useQuery<Tenant[]>({
    queryKey: ['platform', 'tenants'],
    queryFn: () => api('/platform/tenants'),
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState message="No tenants found" />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Tenants</h2>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search tenants..."
      />
    </div>
  );
}
