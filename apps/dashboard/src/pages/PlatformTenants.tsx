import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { DataTable, type Column } from '../components/DataTable';
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

const columns: Column<Tenant>[] = [
  { header: 'Name', accessor: (t) => t.name },
  { header: 'ID', accessor: (t) => t.id },
  { header: 'State', accessor: (t) => t.stateCode },
  { header: 'GSTIN', accessor: (t) => t.gstin ?? '—' },
  { header: 'Created', accessor: (t) => new Date(t.createdAt).toLocaleDateString('en-IN') },
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
      <DataTable columns={columns} data={data} />
    </div>
  );
}
