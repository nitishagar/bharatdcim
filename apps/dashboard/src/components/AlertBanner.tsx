import type { AlertEvent } from '../api/hooks/useAlerts';

interface AlertBannerProps {
  alerts: AlertEvent[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div role="alert" className="bg-red-50 border border-red-200 rounded p-3 mb-4 dark:bg-red-900/20 dark:border-red-800">
      <p className="text-red-800 text-sm font-medium dark:text-red-200">
        {alerts.length} active alert{alerts.length !== 1 ? 's' : ''} — environmental threshold exceeded
      </p>
    </div>
  );
}
