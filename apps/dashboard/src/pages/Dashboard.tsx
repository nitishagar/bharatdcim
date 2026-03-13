import { Link } from 'react-router-dom';
import { useSummary } from '../api/hooks/useSummary';
import { KPICard } from '../components/KPICard';
import { DashboardSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatPaisa } from '../lib/formatCurrency';

export function Dashboard() {
  const { data, isLoading, error, refetch } = useSummary();

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Overview</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard icon="⚡" label="Total Meters" value={data.meters.total} />
        <KPICard
          icon="🔋"
          label="Total Consumption"
          value={data.bills.totalKwh.toLocaleString('en-IN')}
          unit="kWh"
        />
        <KPICard
          icon="₹"
          label="Total Billing"
          value={formatPaisa(data.bills.totalAmountPaisa)}
        />
        <KPICard
          icon="🔌"
          label="Online Agents"
          value={`${data.agents.online}/${data.agents.total}`}
        />
      </div>

      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/billing"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-burgundy hover:shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-burgundy"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Calculate Bill</span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Generate a new bill from meter readings</p>
        </Link>
        <Link
          to="/uploads"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-burgundy hover:shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-burgundy"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload CSV</span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Import meter readings from CSV file</p>
        </Link>
        <Link
          to="/invoices"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-burgundy hover:shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-burgundy"
        >
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generate Invoice</span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create GST invoice from a bill</p>
        </Link>
      </div>
    </div>
  );
}
