import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMeters, useCreateMeter } from '../api/hooks/useMeters';
import { useTariffs } from '../api/hooks/useTariffs';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { createMeterSchema, type CreateMeterForm } from '../lib/schemas';
import type { Meter } from '../api/hooks/useMeters';

const columns: ColumnDef<Meter, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'stateCode', header: 'State' },
  { accessorFn: (m) => m.meterType ?? '—', header: 'Type', id: 'meterType' },
  { accessorFn: (m) => m.tariffId ?? '—', header: 'Tariff', id: 'tariffId' },
  { accessorKey: 'tenantId', header: 'Tenant' },
];

export function Meters() {
  const { data, isLoading, error, refetch } = useMeters();
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meters</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Create Meter
          </button>
        )}
      </div>

      {showForm && (
        <CreateMeterFormComponent
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refetch(); }}
        />
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState message="No meters found" />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(m) => navigate(`/meters/${m.id}`)}
          searchPlaceholder="Search meters..."
          exportFilename="meters"
        />
      )}
    </div>
  );
}

function CreateMeterFormComponent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createMeter = useCreateMeter();
  const { data: tariffs } = useTariffs();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateMeterForm>({
    resolver: zodResolver(createMeterSchema),
  });

  async function onSubmit(formData: CreateMeterForm) {
    try {
      await createMeter.mutateAsync({
        id: crypto.randomUUID(),
        name: formData.name,
        stateCode: formData.stateCode,
        siteId: formData.siteId || undefined,
        tariffId: formData.tariffId || undefined,
        meterType: formData.meterType || undefined,
      });
      reset();
      onCreated();
    } catch {
      // error handled by toast
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meter Name</label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., Main Grid Meter"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State Code</label>
          <input
            {...register('stateCode')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., MH, KA, TN"
          />
          {errors.stateCode && <p className="mt-1 text-sm text-red-500">{errors.stateCode.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site ID (optional)</label>
          <input
            {...register('siteId')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="Site identifier"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tariff</label>
          <select
            {...register('tariffId')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">None</option>
            {tariffs?.map((t) => (
              <option key={t.id} value={t.id}>{t.stateCode} — {t.discom} — {t.category}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meter Type</label>
          <select
            {...register('meterType')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">Select type...</option>
            <option value="grid">Grid</option>
            <option value="dg">DG</option>
            <option value="solar">Solar</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          disabled={createMeter.isPending}
        >
          {createMeter.isPending ? 'Creating...' : 'Create Meter'}
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
