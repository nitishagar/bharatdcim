import { useNavigate } from 'react-router-dom';
import { useBills, type Bill } from '../api/hooks/useBills';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';

const columns: Column<Bill>[] = [
  { header: 'Period', accessor: (b) => `${b.billingPeriodStart} – ${b.billingPeriodEnd}` },
  { header: 'Meter', accessor: (b) => b.meterId },
  { header: 'kWh', accessor: (b) => b.totalKwh.toLocaleString('en-IN') },
  { header: 'Amount', accessor: (b) => formatPaisa(b.totalBillPaisa) },
  { header: 'Status', accessor: (b) => <StatusBadge status={b.status} /> },
];

export function Billing() {
  const { data, isLoading, error, refetch } = useBills();
  const navigate = useNavigate();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState message="No bills found" />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Billing</h2>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(b) => navigate(`/billing/${b.id}`)}
      />
    </div>
  );
}
