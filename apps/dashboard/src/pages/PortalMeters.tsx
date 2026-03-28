import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeters } from '../api/hooks/useMeters';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import type { Meter } from '../api/hooks/useMeters';

const columns: ColumnDef<Meter, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'stateCode', header: 'State' },
  { accessorFn: (m) => m.meterType ?? '—', header: 'Type', id: 'meterType' },
];

export function PortalMeters() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useMeters({ limit: pageSize, offset: pageIndex * pageSize, search });
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meters</h2>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState message="No meters found" />
      ) : (
        <DataTable
          columns={columns}
          data={data.data}
          onRowClick={(m) => navigate(`/portal/meters/${m.id}`)}
          searchPlaceholder="Search meters..."
          exportFilename="meters"
          manualPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={data.total}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          onSearch={(s) => { setSearch(s); setPageIndex(0); }}
        />
      )}
    </div>
  );
}
