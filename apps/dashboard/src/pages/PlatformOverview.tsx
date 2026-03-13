import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { DashboardSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatPaisa } from '../lib/formatCurrency';

interface PlatformStats {
  tenants: { total: number };
  meters: { total: number };
  bills: { total: number; totalAmountPaisa: number };
  invoices: { total: number };
}

export function PlatformOverview() {
  const { data, isLoading, error, refetch } = useQuery<PlatformStats>({
    queryKey: ['platform', 'overview'],
    queryFn: () => api('/platform/overview'),
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  const cards = [
    { label: 'Tenants', value: data.tenants.total },
    { label: 'Meters', value: data.meters.total },
    { label: 'Bills', value: data.bills.total },
    { label: 'Revenue', value: formatPaisa(data.bills.totalAmountPaisa) },
    { label: 'Invoices', value: data.invoices.total },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Platform Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
