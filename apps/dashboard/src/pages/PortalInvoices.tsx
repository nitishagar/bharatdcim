import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices, type Invoice } from '../api/hooks/useInvoices';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';

const columns: ColumnDef<Invoice, unknown>[] = [
  { accessorKey: 'invoiceNumber', header: 'Invoice #' },
  { accessorKey: 'invoiceDate', header: 'Date' },
  { id: 'amount', header: 'Amount', accessorFn: (i) => i.totalAmountPaisa, cell: ({ row }) => formatPaisa(row.original.totalAmountPaisa) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} />, enableSorting: false },
];

export function PortalInvoices() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { data, isLoading, error, refetch } = useInvoices({ limit: pageSize, offset: pageIndex * pageSize });
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Invoices</h2>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState message="No invoices found" />
      ) : (
        <DataTable
          columns={columns}
          data={data.data}
          onRowClick={(i) => navigate(`/portal/invoices/${i.id}`)}
          searchPlaceholder="Search invoices..."
          exportFilename="invoices"
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
