import { useParams, useNavigate } from 'react-router-dom';
import { useAsset, useDeleteAsset } from '../api/hooks/useAssets';
import { useRack } from '../api/hooks/useRacks';
import { DetailSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { Breadcrumb } from '../components/Breadcrumb';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useState } from 'react';

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="bg-white rounded-lg border p-3 dark:bg-gray-800 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{value ?? '—'}</div>
    </div>
  );
}

export function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: asset, isLoading, error } = useAsset(id!);
  const { data: rack } = useRack(asset?.rackId ?? '');
  const deleteAsset = useDeleteAsset();
  const isAdmin = useIsAdmin();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!asset) return null;

  async function handleDelete() {
    try {
      await deleteAsset.mutateAsync(id!);
      navigate('/assets');
    } catch {
      // error handled by toast
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Assets', to: '/assets' }, { label: asset.name }]} />
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{asset.name}</h2>
        {isAdmin && (
          <div className="ml-auto">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Delete Asset
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <DetailRow label="Asset Type" value={asset.assetType} />
        <DetailRow label="Manufacturer" value={asset.manufacturer} />
        <DetailRow label="Model" value={asset.model} />
        <DetailRow label="Serial Number" value={asset.serialNumber} />
        <DetailRow label="Status" value={asset.status} />
        <DetailRow label="Rack" value={rack?.name} />
        <DetailRow label="Rack Unit Start" value={asset.rackUnitStart} />
        <DetailRow label="Rack Unit Size" value={`${asset.rackUnitSize}U`} />
      </div>

      {asset.metadata && (
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metadata</div>
          <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{asset.metadata}</pre>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full dark:bg-gray-800">
            <h3 className="text-lg font-semibold mb-2">Delete Asset?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteAsset.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {deleteAsset.isPending ? 'Deleting...' : 'Delete'}
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
