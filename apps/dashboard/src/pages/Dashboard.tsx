import { Link } from 'react-router-dom';
import { useSummary } from '../api/hooks/useSummary';
import { KPICard } from '../components/KPICard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { formatPaisa } from '../lib/formatCurrency';

export function Dashboard() {
  const { data, isLoading, error, refetch } = useSummary();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Overview</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
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

      <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
      <div className="grid grid-cols-3 gap-4">
        <Link
          to="/billing"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-navy hover:shadow-sm transition-all"
        >
          <span className="text-sm font-medium text-gray-700">Calculate Bill</span>
          <p className="text-xs text-gray-400 mt-1">Generate a new bill from meter readings</p>
        </Link>
        <Link
          to="/uploads"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-navy hover:shadow-sm transition-all"
        >
          <span className="text-sm font-medium text-gray-700">Upload CSV</span>
          <p className="text-xs text-gray-400 mt-1">Import meter readings from CSV file</p>
        </Link>
        <Link
          to="/invoices"
          className="rounded-lg border border-gray-200 bg-white p-4 hover:border-navy hover:shadow-sm transition-all"
        >
          <span className="text-sm font-medium text-gray-700">Generate Invoice</span>
          <p className="text-xs text-gray-400 mt-1">Create GST invoice from a bill</p>
        </Link>
      </div>
    </div>
  );
}
