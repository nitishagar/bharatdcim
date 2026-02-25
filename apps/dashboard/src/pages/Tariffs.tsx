import { useState } from 'react';
import { useTariffs, type Tariff } from '../api/hooks/useTariffs';
import { DataTable, type Column } from '../components/DataTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';

interface TimeSlot {
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  type: string;
  multiplierBps: number;
  adderPaisa: number;
}

const columns: Column<Tariff>[] = [
  { header: 'State', accessor: (t) => t.stateCode },
  { header: 'DISCOM', accessor: (t) => t.discom },
  { header: 'Category', accessor: (t) => t.category },
  { header: 'Rate', accessor: (t) => formatPaisa(t.baseEnergyRatePaisa) + '/kWh' },
  { header: 'Wheeling', accessor: (t) => formatPaisa(t.wheelingChargePaisa) },
  { header: 'Demand', accessor: (t) => formatPaisa(t.demandChargePerKvaPaisa) + '/KVA' },
  { header: 'PF Threshold', accessor: (t) => `${(t.pfThresholdBps / 100).toFixed(1)}%` },
];

export function Tariffs() {
  const { data, isLoading, error, refetch } = useTariffs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState message="No tariffs configured" />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Tariffs</h2>
      <DataTable
        columns={columns}
        data={data}
        onRowClick={(t) => setExpandedId(expandedId === t.id ? null : t.id)}
      />

      {expandedId && (() => {
        const tariff = data.find((t) => t.id === expandedId);
        if (!tariff) return null;
        let slots: TimeSlot[] = [];
        try { slots = JSON.parse(tariff.timeSlotsJson); } catch { /* empty */ }
        if (slots.length === 0) return null;

        return (
          <div className="mt-4 bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Time-of-Day Slots — {tariff.stateCode} {tariff.category}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2">Slot</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Multiplier</th>
                  <th className="pb-2">Adder</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2">
                      {String(s.startHour).padStart(2, '0')}:{String(s.startMinute).padStart(2, '0')} –{' '}
                      {String(s.endHour).padStart(2, '0')}:{String(s.endMinute).padStart(2, '0')}
                    </td>
                    <td className="py-2">{s.type}</td>
                    <td className="py-2">{(s.multiplierBps / 10000).toFixed(2)}x</td>
                    <td className="py-2">{formatPaisa(s.adderPaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}
