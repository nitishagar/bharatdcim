const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  finalized: 'bg-blue-100 text-blue-700',
  invoiced: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}
