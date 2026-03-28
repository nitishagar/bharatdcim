import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMeter, useUpdateMeter, useDeleteMeter, type Meter } from '../api/hooks/useMeters';
import { useReadings } from '../api/hooks/useReadings';
import { useTariffs } from '../api/hooks/useTariffs';
import { DetailSkeleton, Skeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { editMeterSchema, type EditMeterForm } from '../lib/schemas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { useCapacityThresholds } from '../api/hooks/useCapacity';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';

export function MeterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: meter, isLoading: meterLoading, error: meterError, refetch } = useMeter(id!);
  const deleteMeter = useDeleteMeter();
  const isAdmin = useIsAdmin();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showPicker, setShowPicker] = useState(false);

  const from = dateRange?.from?.toISOString().split('T')[0];
  const to = dateRange?.to?.toISOString().split('T')[0];
  const { data: readingsData, isLoading: readingsLoading } = useReadings(id!, from, to, { limit: 500 });
  const readings = readingsData?.data;
  const { data: thresholds } = useCapacityThresholds(id!);

  if (meterLoading) return <DetailSkeleton />;
  if (meterError) return <ErrorMessage error={meterError} />;
  if (!meter) return null;

  const chartData = (readings ?? []).map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    kWh: r.kWh != null ? r.kWh / 1000 : 0,
  }));

  const SMA_WINDOW = 7;
  const smaValues: (number | null)[] = chartData.map((_, i) => {
    if (i < SMA_WINDOW - 1) return null;
    const slice = chartData.slice(i - SMA_WINDOW + 1, i + 1);
    return slice.reduce((sum, d) => sum + d.kWh, 0) / SMA_WINDOW;
  });
  const chartDataWithSma = chartData.map((d, i) => ({ ...d, sma: smaValues[i] }));
  const hasSma = smaValues.some((v) => v !== null);

  const rangeLabel = dateRange?.from && dateRange?.to
    ? `${dateRange.from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — ${dateRange.to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'All time';

  return (
    <div>
      <Breadcrumb items={[{ label: 'Meters', to: '/meters' }, { label: meter.name }]} />
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{meter.name}</h2>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowEditForm(!showEditForm)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Edit Meter
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Delete Meter
            </button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete Meter"
        message={`Are you sure you want to delete "${meter.name}"? This cannot be undone.`}
        onConfirm={() => deleteMeter.mutate(id!, { onSuccess: () => navigate('/meters') })}
        onCancel={() => setShowDeleteDialog(false)}
      />

      {showEditForm && (
        <EditMeterFormComponent
          meter={meter}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); refetch(); }}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">State</span>
          <p className="font-medium dark:text-gray-200">{meter.stateCode}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Type</span>
          <p className="font-medium dark:text-gray-200">{meter.meterType ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Tariff</span>
          <p className="font-medium dark:text-gray-200">{meter.tariffId ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Tenant</span>
          <p className="font-medium dark:text-gray-200">{meter.tenantId}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Readings</h3>
        <div className="relative">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {rangeLabel}
            </button>
            {dateRange && (
              <button
                type="button"
                onClick={() => { setDateRange(undefined); setShowPicker(false); }}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
          {showPicker && (
            <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:bg-gray-800 dark:border-gray-700">
              <DayPicker
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  if (range?.from && range?.to) setShowPicker(false);
                }}
                numberOfMonths={2}
              />
            </div>
          )}
        </div>
      </div>

      {readingsLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : chartData.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No readings available{dateRange ? ' for the selected range' : ' for this meter'}.</p>
      ) : (
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartDataWithSma}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="kWh" stroke="#1e3a5f" strokeWidth={2} dot={false} name="kWh" />
              {hasSma && (
                <Line
                  type="monotone"
                  dataKey="sma"
                  stroke="#6b7280"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  name="7-day Avg"
                />
              )}
              {(thresholds ?? []).map((t) => (
                <ReferenceLine
                  key={`${t.id}-warning`}
                  y={t.warningValue / 1000}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Warning', position: 'insideTopRight', fontSize: 11 }}
                />
              ))}
              {(thresholds ?? []).map((t) => (
                <ReferenceLine
                  key={`${t.id}-critical`}
                  y={t.criticalValue / 1000}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Critical', position: 'insideTopRight', fontSize: 11 }}
                />
              ))}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EditMeterFormComponent({
  meter,
  onClose,
  onSaved,
}: {
  meter: Meter;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateMeter = useUpdateMeter(meter.id);
  const { data: tariffsData } = useTariffs({ limit: 100 });
  const tariffs = tariffsData?.data;

  const { register, handleSubmit, formState: { errors } } = useForm<EditMeterForm>({
    resolver: zodResolver(editMeterSchema),
    defaultValues: {
      name: meter.name,
      stateCode: meter.stateCode,
      siteId: meter.siteId ?? undefined,
      tariffId: meter.tariffId ?? undefined,
      meterType: (meter.meterType as 'grid' | 'dg' | 'solar' | undefined) ?? undefined,
    },
  });

  async function onSubmit(formData: EditMeterForm) {
    try {
      await updateMeter.mutateAsync({
        name: formData.name,
        stateCode: formData.stateCode,
        siteId: formData.siteId ?? null,
        tariffId: formData.tariffId ?? null,
        meterType: formData.meterType ?? null,
      });
      onSaved();
    } catch {
      // error handled by toast
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Edit Meter</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meter Name</label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State Code</label>
          <input
            {...register('stateCode')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
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
          disabled={updateMeter.isPending}
        >
          {updateMeter.isPending ? 'Saving...' : 'Save Changes'}
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
