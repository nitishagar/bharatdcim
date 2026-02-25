import { useParams } from 'react-router-dom';
import { useMeter } from '../api/hooks/useMeters';
import { useReadings } from '../api/hooks/useReadings';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function MeterDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: meter, isLoading: meterLoading, error: meterError } = useMeter(id!);
  const { data: readings, isLoading: readingsLoading } = useReadings(id!);

  if (meterLoading) return <LoadingSpinner />;
  if (meterError) return <ErrorMessage error={meterError} />;
  if (!meter) return null;

  const chartData = (readings ?? []).map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    kWh: r.kWh != null ? r.kWh / 1000 : 0,
  }));

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{meter.name}</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
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

      <h3 className="text-lg font-semibold text-gray-800 mb-3">Readings</h3>
      {readingsLoading ? (
        <LoadingSpinner />
      ) : chartData.length === 0 ? (
        <p className="text-sm text-gray-400">No readings available for this meter.</p>
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
