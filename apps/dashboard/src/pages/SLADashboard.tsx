import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSLAConfigs, useCreateSLA, type SLAConfig } from '../api/hooks/useSLA';
import { KPICard } from '../components/KPICard';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { Skeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';

function CreateSLAForm({ onClose }: { onClose: () => void }) {
  const createSLA = useCreateSLA();
  const [name, setName] = useState('');
  const [type, setType] = useState<'uptime' | 'pue'>('uptime');
  const [targetPct, setTargetPct] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetBps = Math.round(Number(targetPct) * 100);
    try {
      await createSLA.mutateAsync({ name, type, targetBps });
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
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Create SLA Config</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="uptime">Uptime</option>
            <option value="pue">PUE</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target %</label>
          <input
            type="number"
            step="0.01"
            value={targetPct}
            onChange={(e) => setTargetPct(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createSLA.isPending}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        >
          {createSLA.isPending ? 'Saving...' : 'Create'}
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

function SLARow({ config }: { config: SLAConfig }) {
  const targetPct = (config.targetBps / 100).toFixed(2);
  const currentPct = config.currentCompliance != null
    ? (config.currentCompliance / 100).toFixed(2)
    : '—';
  const isCompliant = config.currentCompliance != null && config.currentCompliance >= config.targetBps;

  return (
    <tr>
      <td className="px-4 py-2 text-sm dark:text-gray-200">
        <Link to={`/sla/${config.id}`} className="text-burgundy hover:underline">
          {config.name}
        </Link>
      </td>
      <td className="px-4 py-2 text-sm dark:text-gray-200">{config.type}</td>
      <td className="px-4 py-2 text-sm dark:text-gray-200">{targetPct}%</td>
      <td className="px-4 py-2 text-sm dark:text-gray-200">{currentPct}{currentPct !== '—' ? '%' : ''}</td>
      <td className="px-4 py-2 text-sm">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          config.currentCompliance == null
            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            : isCompliant
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {config.currentCompliance == null ? 'unknown' : isCompliant ? 'compliant' : 'breach'}
        </span>
      </td>
    </tr>
  );
}

export function SLADashboard() {
  const isAdmin = useIsAdmin();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: configs, isLoading, error, refetch } = useSLAConfigs();

  const activeConfigs = (configs ?? []).filter((c) => c.status === 'active');
  const compliantCount = activeConfigs.filter(
    (c) => c.currentCompliance != null && c.currentCompliance >= c.targetBps,
  ).length;
  const compliantPct = activeConfigs.length > 0
    ? Math.round((compliantCount / activeConfigs.length) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SLA Management</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Create SLA
          </button>
        )}
      </div>

      {showCreateForm && <CreateSLAForm onClose={() => setShowCreateForm(false)} />}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <KPICard icon="📋" label="Active SLAs" value={isLoading ? '—' : activeConfigs.length} />
        <KPICard icon="✅" label="Compliant" value={isLoading ? '—' : `${compliantPct}%`} />
        <KPICard icon="⚠" label="Open Violations" value="—" />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !configs || configs.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No SLA configs configured.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="min-w-full bg-white dark:bg-gray-800 text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Target%</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Current%</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => <SLARow key={c.id} config={c} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
