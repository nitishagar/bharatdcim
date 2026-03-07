import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMeter } from '../api/hooks/useMeters';
import { useReadings } from '../api/hooks/useReadings';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { Breadcrumb } from '../components/Breadcrumb';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';

export function MeterDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: meter, isLoading: meterLoading, error: meterError } = useMeter(id!);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showPicker, setShowPicker] = useState(false);

  const from = dateRange?.from?.toISOString().split('T')[0];
  const to = dateRange?.to?.toISOString().split('T')[0];
  const { data: readings, isLoading: readingsLoading } = useReadings(id!, from, to);

  if (meterLoading) return <LoadingSpinner />;
  if (meterError) return <ErrorMessage error={meterError} />;
  if (!meter) return null;

  const chartData = (readings ?? []).map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    kWh: r.kWh != null ? r.kWh / 1000 : 0,
  }));

  const rangeLabel = dateRange?.from && dateRange?.to
    ? `${dateRange.from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} — ${dateRange.to.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : 'All time';

  return (
    <div>
      <Breadcrumb items={[{ label: 'Meters', to: '/meters' }, { label: meter.name }]} />
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{meter.name}</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">State</span>
          <p className="font-medium">{meter.stateCode}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Type</span>
          <p className="font-medium">{meter.meterType ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Tariff</span>
          <p className="font-medium">{meter.tariffId ?? '—'}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Tenant</span>
          <p className="font-medium">{meter.tenantId}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Readings</h3>
        <div className="relative">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {rangeLabel}
            </button>
            {dateRange && (
              <button
                type="button"
                onClick={() => { setDateRange(undefined); setShowPicker(false); }}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
          {showPicker && (
            <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
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
        <LoadingSpinner />
      ) : chartData.length === 0 ? (
        <p className="text-sm text-gray-400">No readings available{dateRange ? ' for the selected range' : ' for this meter'}.</p>
      ) : (
        <div className="bg-white rounded-lg border p-4" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="kWh" stroke="#1e3a5f" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
