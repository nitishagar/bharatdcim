import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { EnvReading } from '../api/hooks/useEnvReadings';

interface EnvChartProps {
  readings: EnvReading[];
}

export function EnvChart({ readings }: EnvChartProps) {
  if (readings.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No environmental data</p>;
  }

  const data = readings.map((r) => ({
    time: new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    tempC: r.tempCTenths != null ? r.tempCTenths / 10 : null,
    humidity: r.humidityPctTenths != null ? r.humidityPctTenths / 10 : null,
  }));

  return (
    <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="tempC" stroke="#dc2626" strokeWidth={2} dot={false} name="Temp (°C)" />
          <Line type="monotone" dataKey="humidity" stroke="#2563eb" strokeWidth={2} dot={false} name="Humidity (%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
