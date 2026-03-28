import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAssets, useCreateAsset } from '../api/hooks/useAssets';
import { useRacks } from '../api/hooks/useRacks';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { createAssetSchema, type CreateAssetForm } from '../lib/schemas';
import type { Asset, AssetType } from '../api/hooks/useAssets';

const ASSET_TYPES: AssetType[] = ['server', 'storage', 'network', 'pdu', 'ups', 'cooling', 'other'];

const columns: ColumnDef<Asset, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'assetType', header: 'Type' },
  { accessorFn: (a) => a.manufacturer ?? '—', header: 'Manufacturer', id: 'manufacturer' },
  { accessorFn: (a) => a.model ?? '—', header: 'Model', id: 'model' },
  { accessorKey: 'status', header: 'Status' },
];

export function Assets() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useAssets({ limit: pageSize, offset: pageIndex * pageSize, search });
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assets</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Add Asset
          </button>
        )}
      </div>

      {showForm && (
        <CreateAssetFormComponent
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refetch(); }}
        />
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState message="No assets found" />
      ) : (
        <DataTable
          columns={columns}
          data={data.data}
          onRowClick={(a) => navigate(`/assets/${a.id}`)}
          searchPlaceholder="Search assets..."
          exportFilename="assets"
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

function CreateAssetFormComponent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createAsset = useCreateAsset();
  const { data: racksData } = useRacks({ limit: 100 });
  const racks = racksData?.data;

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateAssetForm>({
    resolver: zodResolver(createAssetSchema),
  });

  async function onSubmit(formData: CreateAssetForm) {
    try {
      await createAsset.mutateAsync({
        id: crypto.randomUUID(),
        name: formData.name,
        assetType: formData.assetType,
        rackId: formData.rackId || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        rackUnitStart: formData.rackUnitStart ? parseInt(formData.rackUnitStart) : undefined,
        rackUnitSize: formData.rackUnitSize ? parseInt(formData.rackUnitSize) : undefined,
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name</label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., Dell PowerEdge R750"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Type</label>
          <select
            {...register('assetType')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">Select type...</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.assetType && <p className="mt-1 text-sm text-red-500">{errors.assetType.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rack (optional)</label>
          <select
            {...register('rackId')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">None</option>
            {racks?.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manufacturer (optional)</label>
          <input
            {...register('manufacturer')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., Dell"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model (optional)</label>
          <input
            {...register('model')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="e.g., PowerEdge R750"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          disabled={createAsset.isPending}
        >
          {createAsset.isPending ? 'Creating...' : 'Create Asset'}
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
