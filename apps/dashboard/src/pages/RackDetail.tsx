import { useParams, useNavigate } from 'react-router-dom';
import { useRack, useDeleteRack } from '../api/hooks/useRacks';
import { useAssets } from '../api/hooks/useAssets';
import { DetailSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { Breadcrumb } from '../components/Breadcrumb';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';
import type { Asset } from '../api/hooks/useAssets';
import { useState } from 'react';

const assetColumns: ColumnDef<Asset, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'assetType', header: 'Type' },
  { accessorFn: (a) => a.rackUnitStart ?? '—', header: 'Rack Unit', id: 'rackUnit' },
  { accessorKey: 'rackUnitSize', header: 'Size (U)' },
  { accessorKey: 'status', header: 'Status' },
];

export function RackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: rack, isLoading: rackLoading, error: rackError } = useRack(id!);
  const { data: assetsData, isLoading: assetsLoading } = useAssets({ rackId: id, limit: 100, offset: 0 });
  const deleteRack = useDeleteRack();
  const isAdmin = useIsAdmin();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (rackLoading) return <DetailSkeleton />;
  if (rackError) return <ErrorMessage error={rackError} />;
  if (!rack) return null;

  async function handleDelete() {
    try {
      await deleteRack.mutateAsync(id!);
      navigate('/racks');
    } catch {
      // error handled by toast
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Racks', to: '/racks' }, { label: rack.name }]} />
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rack.name}</h2>
        {isAdmin && (
          <div className="ml-auto">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Delete Rack
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-3 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Location</div>
          <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{rack.location ?? '—'}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Capacity</div>
          <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{rack.capacityU}U</div>
        </div>
        <div className="bg-white rounded-lg border p-3 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
          <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{rack.status}</div>
        </div>
        <div className="bg-white rounded-lg border p-3 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">Assets</div>
          <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{assetsData?.total ?? '—'}</div>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">Assets in this Rack</h3>
      {assetsLoading ? (
        <div className="text-sm text-gray-500">Loading assets...</div>
      ) : !assetsData?.data?.length ? (
        <EmptyState message="No assets in this rack" />
      ) : (
        <DataTable
          columns={assetColumns}
          data={assetsData.data}
          onRowClick={(a) => navigate(`/assets/${a.id}`)}
          searchPlaceholder="Search assets..."
          exportFilename={`rack-${id}-assets`}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full dark:bg-gray-800">
            <h3 className="text-lg font-semibold mb-2">Delete Rack?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will delete the rack. If it has active assets, it will be soft-deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteRack.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {deleteRack.isPending ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
