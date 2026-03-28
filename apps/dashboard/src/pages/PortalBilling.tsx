import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBills, type Bill } from '../api/hooks/useBills';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';

const columns: ColumnDef<Bill, unknown>[] = [
  { id: 'period', header: 'Period', accessorFn: (b) => `${b.billingPeriodStart} – ${b.billingPeriodEnd}` },
  { accessorKey: 'meterId', header: 'Meter' },
  { id: 'kwh', header: 'kWh', accessorFn: (b) => b.totalKwh, cell: ({ row }) => row.original.totalKwh.toLocaleString('en-IN') },
  { id: 'amount', header: 'Amount', accessorFn: (b) => b.totalBillPaisa, cell: ({ row }) => formatPaisa(row.original.totalBillPaisa) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} />, enableSorting: false },
];

export function PortalBilling() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error, refetch } = useBills({ limit: pageSize, offset: pageIndex * pageSize });
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bills</h2>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState message="No bills found" />
      ) : (
        <DataTable
          columns={columns}
          data={data.data}
          onRowClick={(b) => navigate(`/portal/billing/${b.id}`)}
          searchPlaceholder="Search bills..."
          exportFilename="bills"
          manualPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={data.total}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}
