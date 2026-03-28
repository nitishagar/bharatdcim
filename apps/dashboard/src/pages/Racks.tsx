import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRacks, useCreateRack } from '../api/hooks/useRacks';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { createRackSchema, type CreateRackForm } from '../lib/schemas';
import type { Rack } from '../api/hooks/useRacks';

const columns: ColumnDef<Rack, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorFn: (r) => r.location ?? '—', header: 'Location', id: 'location' },
  { accessorKey: 'capacityU', header: 'Capacity (U)' },
  { accessorKey: 'status', header: 'Status' },
];

export function Racks() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useRacks({ limit: pageSize, offset: pageIndex * pageSize, search });
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Racks</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Add Rack
          </button>
        )}
      </div>

      {showForm && (
        <CreateRackFormComponent
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refetch(); }}
        />
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState message="No racks found" />
      ) : (
        <DataTable
          columns={columns}
          data={data.data}
          onRowClick={(r) => navigate(`/racks/${r.id}`)}
          searchPlaceholder="Search racks..."
          exportFilename="racks"
          manualPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={data.total}
          onPageChange={setPageIndex}
          onPageSizeChange={setPageSize}
          onSearch={(s) => { setSearch(s); setPageIndex(0); }}
        />
      )}
    </div>
  );
}

function CreateRackFormComponent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createRack = useCreateRack();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateRackForm>({
    resolver: zodResolver(createRackSchema),
  });

  async function onSubmit(formData: CreateRackForm) {
    try {
      await createRack.mutateAsync({
        id: crypto.randomUUID(),
        name: formData.name,
        location: formData.location || undefined,
        capacityU: formData.capacityU ? parseInt(formData.capacityU) : undefined,
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rack Name</label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., Row A Rack 01"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location (optional)</label>
          <input
            {...register('location')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., Floor 1, Row A"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacity (U) (optional)</label>
          <input
            {...register('capacityU')}
            type="number"
            min="1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="42"
          />
          {errors.capacityU && <p className="mt-1 text-sm text-red-500">{errors.capacityU.message}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          disabled={createRack.isPending}
        >
          {createRack.isPending ? 'Creating...' : 'Create Rack'}
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
