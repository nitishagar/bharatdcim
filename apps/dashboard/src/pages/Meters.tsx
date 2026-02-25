import { useNavigate } from 'react-router-dom';
import { useMeters } from '../api/hooks/useMeters';
import { DataTable, type Column } from '../components/DataTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import type { Meter } from '../api/hooks/useMeters';

const columns: Column<Meter>[] = [
  { header: 'Name', accessor: (m) => m.name },
  { header: 'State', accessor: (m) => m.stateCode },
  { header: 'Type', accessor: (m) => m.meterType ?? '—' },
  { header: 'Tariff', accessor: (m) => m.tariffId ?? '—' },
  { header: 'Tenant', accessor: (m) => m.tenantId },
];

export function Meters() {
  const { data, isLoading, error, refetch } = useMeters();
  const navigate = useNavigate();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState message="No meters found" />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Meters</h2>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(m) => navigate(`/meters/${m.id}`)}
      />
    </div>
  );
}
