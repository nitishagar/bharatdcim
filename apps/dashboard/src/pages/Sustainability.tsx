import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRecs, useCreateRec, useRetireRec, useEmissions, useComputeEmissions, type Rec, type CarbonEmission } from '../api/hooks/useSustainability';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { KPICard } from '../components/KPICard';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { createRecSchema, computeEmissionsSchema, type CreateRecForm, type ComputeEmissionsForm } from '../lib/schemas';

const recColumns: ColumnDef<Rec, unknown>[] = [
  { accessorKey: 'serialNumber', header: 'Serial Number' },
  { accessorKey: 'certificateType', header: 'Type' },
  { accessorKey: 'source', header: 'Source' },
  { id: 'mwh', header: 'MWh', accessorFn: (r) => r.mwh, cell: ({ row }) => (row.original.mwh / 1000).toFixed(1) },
  { id: 'vintage', header: 'Vintage', accessorFn: (r) => r.vintagePeriodStart, cell: ({ row }) => `${row.original.vintagePeriodStart} – ${row.original.vintagePeriodEnd}` },
  { accessorKey: 'status', header: 'Status' },
];

const emissionsColumns: ColumnDef<CarbonEmission, unknown>[] = [
  { id: 'period', header: 'Period', accessorFn: (e) => e.periodStart, cell: ({ row }) => `${row.original.periodStart} – ${row.original.periodEnd}` },
  { id: 'gross', header: 'Scope-2 Gross', accessorFn: (e) => e.scope2GrossKg, cell: ({ row }) => `${row.original.scope2GrossKg.toLocaleString()} kg CO₂e` },
  { id: 'net', header: 'Scope-2 Net', accessorFn: (e) => e.scope2NetKg, cell: ({ row }) => `${row.original.scope2NetKg.toLocaleString()} kg CO₂e` },
  { id: 'offset', header: 'REC Offset', accessorFn: (e) => e.recOffsetKwh, cell: ({ row }) => `${(row.original.recOffsetKwh / 1000).toFixed(1)} MWh` },
  { id: 'factor', header: 'Grid Factor', accessorFn: (e) => e.gridEmissionFactorGPerKwh, cell: ({ row }) => `${row.original.gridEmissionFactorGPerKwh} g/kWh` },
];

export function Sustainability() {
  const isAdmin = useIsAdmin();
  const [recPage, setRecPage] = useState(0);
  const [recPageSize, setRecPageSize] = useState(25);
  const [recSearch, setRecSearch] = useState('');
  const [emissionsPage, setEmissionsPage] = useState(0);
  const [emissionsPageSize, setEmissionsPageSize] = useState(25);
  const [showRecForm, setShowRecForm] = useState(false);
  const [showEmissionsForm, setShowEmissionsForm] = useState(false);
  const [retireTargetId, setRetireTargetId] = useState<string | null>(null);

  const { data: recsData, isLoading: recsLoading, error: recsError, refetch: refetchRecs } = useRecs({
    limit: recPageSize, offset: recPage * recPageSize, search: recSearch,
  });
  const { data: emissionsData, isLoading: emissionsLoading, error: emissionsError, refetch: refetchEmissions } = useEmissions({
    limit: emissionsPageSize, offset: emissionsPage * emissionsPageSize,
  });
  const retireRec = useRetireRec();

  // Latest emission summary for KPI cards
  const latestEmission = emissionsData?.data?.[0];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {latestEmission && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="scope2-summary">
          <KPICard label="Scope-2 Gross (latest period)" value={latestEmission.scope2GrossKg.toLocaleString()} unit="kg CO₂e" icon="🏭" />
          <KPICard label="Scope-2 Net (latest period)" value={latestEmission.scope2NetKg.toLocaleString()} unit="kg CO₂e" icon="🌿" />
          <KPICard label="REC Offset (latest period)" value={(latestEmission.recOffsetKwh / 1000).toFixed(1)} unit="MWh" icon="♻️" />
        </div>
      )}

      {/* RECs Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">REC Certificates</h2>
          {isAdmin && (
            <button
              onClick={() => setShowRecForm(!showRecForm)}
              className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
            >
              Add REC
            </button>
          )}
        </div>

        {showRecForm && (
          <CreateRecFormComponent
            onClose={() => setShowRecForm(false)}
            onCreated={() => { setShowRecForm(false); refetchRecs(); }}
          />
        )}

        {retireTargetId && (
          <RetireRecDialog
            recId={retireTargetId}
            onConfirm={(period) => {
              retireRec.mutate({ id: retireTargetId, retiredAgainstPeriod: period }, {
                onSuccess: () => { setRetireTargetId(null); refetchRecs(); },
                onError: () => setRetireTargetId(null),
              });
            }}
            onCancel={() => setRetireTargetId(null)}
          />
        )}

        {recsLoading ? (
          <TableSkeleton />
        ) : recsError ? (
          <ErrorMessage error={recsError} onRetry={() => refetchRecs()} />
        ) : !recsData?.data?.length ? (
          <EmptyState message="No REC certificates" />
        ) : (
          <DataTable
            columns={recColumns}
            data={recsData.data}
            onRowClick={(r) => isAdmin && r.status === 'active' && setRetireTargetId(r.id)}
            searchPlaceholder="Search by serial number..."
            exportFilename="rec-certificates"
            manualPagination
            pageIndex={recPage}
            pageSize={recPageSize}
            totalRows={recsData.total}
            onPageChange={setRecPage}
            onPageSizeChange={setRecPageSize}
            onSearch={(s) => { setRecSearch(s); setRecPage(0); }}
          />
        )}
      </div>

      {/* Emissions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scope-2 Emissions</h2>
          {isAdmin && (
            <button
              onClick={() => setShowEmissionsForm(!showEmissionsForm)}
              className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
            >
              Compute Emissions
            </button>
          )}
        </div>

        {showEmissionsForm && (
          <ComputeEmissionsFormComponent
            onClose={() => setShowEmissionsForm(false)}
            onComputed={() => { setShowEmissionsForm(false); refetchEmissions(); }}
          />
        )}

        {emissionsLoading ? (
          <TableSkeleton />
        ) : emissionsError ? (
          <ErrorMessage error={emissionsError} onRetry={() => refetchEmissions()} />
        ) : !emissionsData?.data?.length ? (
          <EmptyState message="No emissions records — compute one to get started" />
        ) : (
          <DataTable
            columns={emissionsColumns}
            data={emissionsData.data}
            exportFilename="scope2-emissions"
            manualPagination
            pageIndex={emissionsPage}
            pageSize={emissionsPageSize}
            totalRows={emissionsData.total}
            onPageChange={setEmissionsPage}
            onPageSizeChange={setEmissionsPageSize}
          />
        )}
      </div>
    </div>
  );
}

function CreateRecFormComponent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const createRec = useCreateRec();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateRecForm>({
    resolver: zodResolver(createRecSchema),
    defaultValues: { certificateType: 'REC', source: 'solar' },
  });

  async function onSubmit(formData: CreateRecForm) {
    try {
      await createRec.mutateAsync({
        id: crypto.randomUUID(),
        certificateType: formData.certificateType,
        serialNumber: formData.serialNumber,
        source: formData.source,
        mwh: parseInt(formData.mwh),
        vintagePeriodStart: formData.vintagePeriodStart,
        vintagePeriodEnd: formData.vintagePeriodEnd,
      });
      reset();
      onCreated();
    } catch { /* error handled by toast */ }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add REC Certificate</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select {...register('certificateType')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
            <option value="REC">REC (India)</option>
            <option value="I-REC">I-REC (International)</option>
          </select>
          {errors.certificateType && <p className="mt-1 text-sm text-red-500">{errors.certificateType.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
          <input {...register('serialNumber')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="e.g., IN-REC-2026-001" />
          {errors.serialNumber && <p className="mt-1 text-sm text-red-500">{errors.serialNumber.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Energy Source</label>
          <select {...register('source')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
            <option value="solar">Solar</option>
            <option value="wind">Wind</option>
            <option value="hydro">Hydro</option>
            <option value="other">Other</option>
          </select>
          {errors.source && <p className="mt-1 text-sm text-red-500">{errors.source.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MWh (×1000, e.g. 1000 = 1 MWh)</label>
          <input type="number" {...register('mwh')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="1000" />
          {errors.mwh && <p className="mt-1 text-sm text-red-500">{errors.mwh.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vintage Period Start</label>
          <input type="date" {...register('vintagePeriodStart')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          {errors.vintagePeriodStart && <p className="mt-1 text-sm text-red-500">{errors.vintagePeriodStart.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vintage Period End</label>
          <input type="date" {...register('vintagePeriodEnd')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          {errors.vintagePeriodEnd && <p className="mt-1 text-sm text-red-500">{errors.vintagePeriodEnd.message}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={createRec.isPending} className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark">
          {createRec.isPending ? 'Adding...' : 'Add Certificate'}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function RetireRecDialog({ recId, onConfirm, onCancel }: { recId: string; onConfirm: (period: string) => void; onCancel: () => void }) {
  const [period, setPeriod] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg border p-6 w-full max-w-sm space-y-4 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Retire REC Certificate</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Certificate ID: <code>{recId}</code></p>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Retire Against Period (optional)</label>
          <input
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="e.g., 2026-03"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onConfirm(period)} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Retire</button>
          <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ComputeEmissionsFormComponent({ onClose, onComputed }: { onClose: () => void; onComputed: () => void }) {
  const computeEmissions = useComputeEmissions();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ComputeEmissionsForm>({
    resolver: zodResolver(computeEmissionsSchema),
  });

  async function onSubmit(formData: ComputeEmissionsForm) {
    try {
      await computeEmissions.mutateAsync({
        periodStart: formData.periodStart,
        periodEnd: formData.periodEnd,
        gridEmissionFactorGPerKwh: formData.gridEmissionFactorGPerKwh ? parseInt(formData.gridEmissionFactorGPerKwh) : undefined,
      });
      reset();
      onComputed();
    } catch { /* error handled by toast */ }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Compute Scope-2 Emissions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period Start</label>
          <input type="date" {...register('periodStart')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          {errors.periodStart && <p className="mt-1 text-sm text-red-500">{errors.periodStart.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period End</label>
          <input type="date" {...register('periodEnd')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          {errors.periodEnd && <p className="mt-1 text-sm text-red-500">{errors.periodEnd.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grid Emission Factor (g CO₂e/kWh, default 710)</label>
          <input type="number" {...register('gridEmissionFactorGPerKwh')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="710" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={computeEmissions.isPending} className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark">
          {computeEmissions.isPending ? 'Computing...' : 'Compute'}
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  );
}
