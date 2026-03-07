import { useState, useRef } from 'react';
import { useUploads, useUploadCSV, type Upload } from '../api/hooks/useUploads';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { useIsAdmin } from '../hooks/useIsAdmin';

const columns: Column<Upload>[] = [
  { header: 'File', accessor: (u) => u.fileName },
  { header: 'Format', accessor: (u) => <StatusBadge status={u.format} /> },
  {
    header: 'Rows',
    accessor: (u) => (
      <span>
        {u.importedRows} imported
        {u.skippedRows > 0 && <span className="text-amber-600"> / {u.skippedRows} skipped</span>}
      </span>
    ),
  },
  { header: 'Size', accessor: (u) => formatFileSize(u.fileSize) },
  { header: 'Time', accessor: (u) => `${u.processingTimeMs}ms` },
  { header: 'Date', accessor: (u) => new Date(u.createdAt).toLocaleDateString('en-IN') },
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
        <h2 className="text-2xl font-bold text-gray-900">Uploads</h2>
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
        <form onSubmit={handleUpload} className="bg-white rounded-lg border p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-burgundy file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-burgundy-dark"
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
          {upload.error && <p className="text-sm text-red-600">{upload.error.message}</p>}
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
    <div className="mt-2 bg-white rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Tenant</span>
          <p className="font-medium">{upload.tenantId}</p>
        </div>
        <div>
          <span className="text-gray-500">Format Detected</span>
          <p className="font-medium">{upload.format}</p>
        </div>
        <div>
          <span className="text-gray-500">Meters Affected</span>
          <p className="font-medium">{meters.length > 0 ? meters.join(', ') : 'None'}</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-700 mb-1">Errors ({errors.length})</h4>
          <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-200 text-left">
                  <th className="px-3 py-1.5 text-red-800">Row</th>
                  <th className="px-3 py-1.5 text-red-800">Code</th>
                  <th className="px-3 py-1.5 text-red-800">Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 20).map((err, i) => (
                  <tr key={i} className="border-b border-red-100">
                    <td className="px-3 py-1">{err.row}</td>
                    <td className="px-3 py-1 font-mono text-xs">{err.code}</td>
                    <td className="px-3 py-1">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {errors.length > 20 && (
              <p className="px-3 py-1.5 text-xs text-red-600">
                Showing 20 of {errors.length} errors
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
