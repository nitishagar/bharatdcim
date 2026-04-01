import { useState } from 'react';
import { useMeters } from '../api/hooks/useMeters';
import {
  useCapacityThresholds,
  useCapacityAlerts,
  useCapacityForecast,
  useCreateThreshold,
  type CapacityThreshold,
} from '../api/hooks/useCapacity';
import { KPICard } from '../components/KPICard';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { Skeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';

function ForecastCard({ meterId, meterName }: { meterId: string; meterName: string }) {
  const { data: forecast, isLoading, error } = useCapacityForecast(meterId, 30);

  if (isLoading) return <Skeleton className="h-32" />;
  if (error) return <ErrorMessage error={error} />;
  if (!forecast) return null;

  return (
    <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
      <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">{meterName}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Trend Slope</span>
          <p className="font-medium dark:text-gray-200">
            {forecast.trendSlope > 0 ? '+' : ''}{forecast.trendSlope.toFixed(1)} kWh/day
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">R²</span>
          <p className="font-medium dark:text-gray-200">{(forecast.r2 * 100).toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-2">
        {forecast.projectedBreachAt ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Projected breach: {new Date(forecast.projectedBreachAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        ) : (
          <p className="text-sm text-green-600 dark:text-green-400">Stable</p>
        )}
      </div>
    </div>
  );
}

function AddThresholdForm({ onClose }: { onClose: () => void }) {
  const { data: metersData } = useMeters({ limit: 100 });
  const meters = metersData?.data ?? [];
  const createThreshold = useCreateThreshold();

  const [meterId, setMeterId] = useState('');
  const [metric, setMetric] = useState<'kwh_daily' | 'kw_peak' | 'kwh_monthly'>('kwh_daily');
  const [warningValue, setWarningValue] = useState('');
  const [criticalValue, setCriticalValue] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meterId || !warningValue || !criticalValue) return;
    try {
      await createThreshold.mutateAsync({
        meterId,
        metric,
        warningValue: Number(warningValue),
        criticalValue: Number(criticalValue),
      });
      onClose();
    } catch {
      // error handled by toast
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700"
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Threshold</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meter</label>
          <select
            value={meterId}
            onChange={(e) => setMeterId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          >
            <option value="">Select meter...</option>
            {meters.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as typeof metric)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="kwh_daily">Daily kWh</option>
            <option value="kw_peak">Peak kW</option>
            <option value="kwh_monthly">Monthly kWh</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Warning Value</label>
          <input
            type="number"
            value={warningValue}
            onChange={(e) => setWarningValue(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Critical Value</label>
          <input
            type="number"
            value={criticalValue}
            onChange={(e) => setCriticalValue(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createThreshold.isPending}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        >
          {createThreshold.isPending ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ThresholdRow({ threshold }: { threshold: CapacityThreshold }) {
  return (
    <tr>
      <td className="px-4 py-2 text-sm dark:text-gray-200">{threshold.meterId}</td>
      <td className="px-4 py-2 text-sm dark:text-gray-200">{threshold.metric}</td>
      <td className="px-4 py-2 text-sm text-amber-600">{threshold.warningValue.toLocaleString()}</td>
      <td className="px-4 py-2 text-sm text-red-600">{threshold.criticalValue.toLocaleString()}</td>
      <td className="px-4 py-2 text-sm">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          threshold.status === 'active'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {threshold.status}
        </span>
      </td>
    </tr>
  );
}

export function CapacityPlanning() {
  const isAdmin = useIsAdmin();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: thresholds, isLoading: thresholdsLoading, error: thresholdsError, refetch: refetchThresholds } = useCapacityThresholds();
  const { data: alerts, isLoading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useCapacityAlerts();
  const { data: metersData } = useMeters({ limit: 100 });
  const meters = metersData?.data ?? [];

  const activeAlerts = (alerts ?? []).filter((a) => a.status === 'active');
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
  const metersAtRisk = new Set(criticalAlerts.map((a) => a.meterId).filter(Boolean)).size;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Capacity Planning</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Add Threshold
          </button>
        )}
      </div>

      {showAddForm && <AddThresholdForm onClose={() => setShowAddForm(false)} />}

      {alertsError ? (
        <ErrorMessage error={alertsError} onRetry={() => refetchAlerts()} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <KPICard icon="⚠" label="Meters at Risk" value={alertsLoading ? '—' : metersAtRisk} />
          <KPICard icon="🔔" label="Active Alerts" value={alertsLoading ? '—' : activeAlerts.length} />
          <KPICard icon="📊" label="Thresholds" value={thresholdsLoading ? '—' : (thresholds?.length ?? 0)} />
        </div>
      )}

      {meters.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Meter Forecasts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {meters.map((meter) => (
              <ForecastCard key={meter.id} meterId={meter.id} meterName={meter.name} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Thresholds</h3>
        {thresholdsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : thresholdsError ? (
          <ErrorMessage error={thresholdsError} onRetry={() => refetchThresholds()} />
        ) : !thresholds || thresholds.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No thresholds configured.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
            <table className="min-w-full bg-white dark:bg-gray-800 text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Meter</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Metric</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Warning</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Critical</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t) => <ThresholdRow key={t.id} threshold={t} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
