interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
}

export function KPICard({ label, value, unit, icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}
