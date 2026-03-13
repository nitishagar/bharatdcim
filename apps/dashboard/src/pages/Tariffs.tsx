import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTariffs, useCreateTariff, type Tariff } from '../api/hooks/useTariffs';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { createTariffSchema, type CreateTariffForm } from '../lib/schemas';

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

const columns: ColumnDef<Tariff, unknown>[] = [
  { accessorKey: 'stateCode', header: 'State' },
  { accessorKey: 'discom', header: 'DISCOM' },
  { accessorKey: 'category', header: 'Category' },
  { id: 'rate', header: 'Rate', accessorFn: (t) => t.baseEnergyRatePaisa, cell: ({ row }) => formatPaisa(row.original.baseEnergyRatePaisa) + '/kWh' },
  { id: 'wheeling', header: 'Wheeling', accessorFn: (t) => t.wheelingChargePaisa, cell: ({ row }) => formatPaisa(row.original.wheelingChargePaisa) },
  { id: 'demand', header: 'Demand', accessorFn: (t) => t.demandChargePerKvaPaisa, cell: ({ row }) => formatPaisa(row.original.demandChargePerKvaPaisa) + '/KVA' },
  { id: 'pf', header: 'PF Threshold', accessorFn: (t) => t.pfThresholdBps, cell: ({ row }) => `${(row.original.pfThresholdBps / 100).toFixed(1)}%` },
];

export function Tariffs() {
  const { data, isLoading, error, refetch } = useTariffs();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isAdmin = useIsAdmin();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tariffs</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Create Tariff
          </button>
        )}
      </div>

      {showForm && (
        <CreateTariffFormComponent
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refetch(); }}
        />
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState message="No tariffs configured" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data}
            onRowClick={(t) => setExpandedId(expandedId === t.id ? null : t.id)}
            searchPlaceholder="Search tariffs..."
            exportFilename="tariffs"
          />

          {expandedId && (() => {
            const tariff = data.find((t) => t.id === expandedId);
            if (!tariff) return null;
            let slots: TimeSlot[] = [];
            try { slots = JSON.parse(tariff.timeSlotsJson); } catch { /* empty */ }
            if (slots.length === 0) return null;

            return (
              <div className="mt-4 bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Time-of-Day Slots — {tariff.stateCode} {tariff.category}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500 dark:text-gray-400 dark:border-gray-600">
                      <th className="pb-2">Slot</th>
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Multiplier</th>
                      <th className="pb-2">Adder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-gray-700 dark:text-gray-300">
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
        </>
      )}
    </div>
  );
}

function CreateTariffFormComponent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createTariff = useCreateTariff();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateTariffForm>({
    resolver: zodResolver(createTariffSchema),
    defaultValues: { billingUnit: 'kWh' },
  });

  async function onSubmit(formData: CreateTariffForm) {
    try {
      await createTariff.mutateAsync({
        id: crypto.randomUUID(),
        stateCode: formData.stateCode,
        discom: formData.discom,
        category: formData.category,
        baseEnergyRatePaisa: parseInt(formData.baseEnergyRatePaisa),
        wheelingChargePaisa: formData.wheelingChargePaisa ? parseInt(formData.wheelingChargePaisa) : 0,
        demandChargePerKvaPaisa: formData.demandChargePerKvaPaisa ? parseInt(formData.demandChargePerKvaPaisa) : 0,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || null,
        billingUnit: formData.billingUnit ?? 'kWh',
      });
      reset();
      onCreated();
    } catch {
      // error handled by toast
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State Code</label>
          <input
            {...register('stateCode')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., MH, KA, TN"
          />
          {errors.stateCode && <p className="mt-1 text-sm text-red-500">{errors.stateCode.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">DISCOM</label>
          <input
            {...register('discom')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., MSEDCL, BESCOM"
          />
          {errors.discom && <p className="mt-1 text-sm text-red-500">{errors.discom.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
          <input
            {...register('category')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., HT-Industrial"
          />
          {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Energy Rate (paisa/kWh)</label>
          <input
            type="number"
            {...register('baseEnergyRatePaisa')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., 750"
          />
          {errors.baseEnergyRatePaisa && <p className="mt-1 text-sm text-red-500">{errors.baseEnergyRatePaisa.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wheeling Charge (paisa)</label>
          <input
            type="number"
            {...register('wheelingChargePaisa')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Demand Charge (paisa/KVA)</label>
          <input
            type="number"
            {...register('demandChargePerKvaPaisa')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Effective From</label>
          <input
            type="date"
            {...register('effectiveFrom')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
          {errors.effectiveFrom && <p className="mt-1 text-sm text-red-500">{errors.effectiveFrom.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Effective To (optional)</label>
          <input
            type="date"
            {...register('effectiveTo')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Billing Unit</label>
          <select
            {...register('billingUnit')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="kWh">kWh</option>
            <option value="kVAh">kVAh</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          disabled={createTariff.isPending}
        >
          {createTariff.isPending ? 'Creating...' : 'Create Tariff'}
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
