import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSLADetail, useSLAViolations, useUpdateSLA, useUpdateViolation, type SLAViolation } from '../api/hooks/useSLA';
import { Breadcrumb } from '../components/Breadcrumb';
import { Skeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { useIsAdmin } from '../hooks/useIsAdmin';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

function ViolationRow({ violation, onAcknowledge }: { violation: SLAViolation; onAcknowledge: (id: string) => void }) {
  const gapPct = ((violation.gapBps / violation.targetBps) * 100).toFixed(1);
  return (
    <tr>
      <td className="px-4 py-2 text-sm dark:text-gray-200">
        {new Date(violation.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-4 py-2 text-sm">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          violation.severity === 'critical'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        }`}>
          {violation.severity}
        </span>
      </td>
      <td className="px-4 py-2 text-sm text-red-600">-{gapPct}%</td>
      <td className="px-4 py-2 text-sm dark:text-gray-200">{violation.status}</td>
      <td className="px-4 py-2 text-sm">
        {violation.status === 'open' && (
          <button
            type="button"
            onClick={() => onAcknowledge(violation.id)}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Acknowledge
          </button>
        )}
      </td>
    </tr>
  );
}

export function SLADetail() {
  const { id } = useParams<{ id: string }>();
  const isAdmin = useIsAdmin();
  const [showEditForm, setShowEditForm] = useState(false);

  const { data: config, isLoading, error } = useSLADetail(id);
  const { data: violationsData } = useSLAViolations(id!);
  const updateViolation = useUpdateViolation();
  const updateSLA = useUpdateSLA(id!);

  const violations = violationsData?.data ?? [];

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error) return <ErrorMessage error={error} />;
  if (!config) return null;

  const targetPct = config.targetBps / 100;

  // Build a simple chart from violations (show compliance vs target)
  const chartData = violations.map((v) => ({
    date: new Date(v.periodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    compliance: (v.actualBps / 100).toFixed(2),
  }));

  return (
    <div>
      <Breadcrumb items={[{ label: 'SLA Management', to: '/sla' }, { label: config.name }]} />

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{config.name}</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {config.type}
        </span>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowEditForm(!showEditForm)}
            className="ml-auto rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Edit SLA
          </button>
        )}
      </div>

      {showEditForm && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await updateSLA.mutateAsync({ name: fd.get('name') as string }).catch(() => {});
            setShowEditForm(false);
          }}
          className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700"
        >
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Edit SLA</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              name="name"
              defaultValue={config.name}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={updateSLA.isPending} className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark">
              {updateSLA.isPending ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowEditForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Target</span>
          <p className="font-medium dark:text-gray-200">{targetPct.toFixed(2)}%</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Window</span>
          <p className="font-medium dark:text-gray-200">{config.measurementWindow}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
          <p className="font-medium dark:text-gray-200">{config.status}</p>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Compliance History</h3>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700" style={{ height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="compliance" stroke="#1e3a5f" strokeWidth={2} dot={false} name="Compliance %" />
              <ReferenceLine
                y={targetPct}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: 'Target', position: 'insideTopRight', fontSize: 11 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Violations</h3>
        {violations.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No violations recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
            <table className="min-w-full bg-white dark:bg-gray-800 text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Period</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Severity</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Gap</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <ViolationRow
                    key={v.id}
                    violation={v}
                    onAcknowledge={(vid) => updateViolation.mutate({ id: vid, status: 'acknowledged' })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
