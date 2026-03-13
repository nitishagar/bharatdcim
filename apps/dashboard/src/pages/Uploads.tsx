import { useState, useRef } from 'react';
import { useUploads, useUploadCSV, type Upload } from '../api/hooks/useUploads';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { formatDate } from '../lib/formatDate';

const columns: ColumnDef<Upload, unknown>[] = [
  { accessorKey: 'fileName', header: 'File' },
  { accessorKey: 'format', header: 'Format', cell: ({ row }) => <StatusBadge status={row.original.format} />, enableSorting: false },
  {
    id: 'rows',
    header: 'Rows',
    accessorFn: (u) => u.importedRows,
    cell: ({ row }) => (
      <span>
        {row.original.importedRows} imported
        {row.original.skippedRows > 0 && <span className="text-amber-600"> / {row.original.skippedRows} skipped</span>}
      </span>
    ),
  },
  { id: 'size', header: 'Size', accessorFn: (u) => u.fileSize, cell: ({ row }) => formatFileSize(row.original.fileSize) },
  { id: 'time', header: 'Time', accessorFn: (u) => u.processingTimeMs, cell: ({ row }) => `${row.original.processingTimeMs}ms` },
  { id: 'date', header: 'Date', accessorFn: (u) => u.createdAt, cell: ({ row }) => formatDate(row.original.createdAt) },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Uploads() {
  const { data, isLoading, error, refetch } = useUploads();
  const upload = useUploadCSV();
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = useIsAdmin();

  const [showForm, setShowForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      await upload.mutateAsync({ file: selectedFile });
      setShowForm(false);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Uploads</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Upload CSV
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-burgundy file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-burgundy-dark"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
              disabled={upload.isPending || !selectedFile}
            >
              {upload.isPending ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
          {/* errors handled by toast notifications */}
        </form>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState message="No uploads found" />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data}
            onRowClick={(u) => setExpandedId(expandedId === u.id ? null : u.id)}
            searchPlaceholder="Search uploads..."
            exportFilename="uploads"
          />
          {expandedId && <UploadErrors upload={data.find((u) => u.id === expandedId)} />}
        </>
      )}
    </div>
  );
}

function UploadErrors({ upload }: { upload?: Upload }) {
  if (!upload) return null;

  const errors = upload.errorsJson ? JSON.parse(upload.errorsJson) as { code: string; row: number; message: string }[] : [];
  const meters = upload.metersAffected ? JSON.parse(upload.metersAffected) as string[] : [];

  return (
    <div className="mt-2 bg-white rounded-lg border p-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Tenant</span>
          <p className="font-medium">{upload.tenantId}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Format Detected</span>
          <p className="font-medium">{upload.format}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Meters Affected</span>
          <p className="font-medium">{meters.length > 0 ? meters.join(', ') : 'None'}</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Errors ({errors.length})</h4>
          <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden dark:bg-red-900/20 dark:border-red-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200 dark:border-red-800 text-left">
                  <th className="px-3 py-1.5 text-red-800 dark:text-red-300">Row</th>
                  <th className="px-3 py-1.5 text-red-800 dark:text-red-300">Code</th>
                  <th className="px-3 py-1.5 text-red-800 dark:text-red-300">Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 20).map((err, i) => (
                  <tr key={i} className="border-b border-red-100 dark:border-red-800/50">
                    <td className="px-3 py-1">{err.row}</td>
                    <td className="px-3 py-1 font-mono text-xs">{err.code}</td>
                    <td className="px-3 py-1">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.length > 20 && (
              <p className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400">
                Showing 20 of {errors.length} errors
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
