import { useAgents, type Agent } from '../api/hooks/useAgents';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';

function StatusDot({ agent }: { agent: Agent }) {
  const now = Date.now();
  const heartbeatAge = now - new Date(agent.lastHeartbeatAt).getTime();
  const fiveMin = 5 * 60 * 1000;

  let color: string;
  let label: string;

  if (agent.status !== 'online') {
    color = 'bg-red-500';
    label = 'Offline';
  } else if (heartbeatAge > fiveMin) {
    color = 'bg-amber-500';
    label = 'Stale';
  } else {
    color = 'bg-green-500';
    label = 'Online';
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const columns: ColumnDef<Agent, unknown>[] = [
  { accessorKey: 'agentId', header: 'Agent ID' },
  { id: 'version', header: 'Version', accessorFn: (a) => a.agentVersion ?? '—' },
  { accessorKey: 'deviceCount', header: 'Devices' },
  { id: 'unsynced', header: 'Unsynced', accessorFn: (a) => a.unsyncedCount ?? 0 },
  { id: 'status', header: 'Status', accessorFn: (a) => a.status, cell: ({ row }) => <StatusDot agent={row.original} />, enableSorting: false },
  { id: 'heartbeat', header: 'Last Heartbeat', accessorFn: (a) => a.lastHeartbeatAt, cell: ({ row }) => formatAge(row.original.lastHeartbeatAt) },
];

export function Agents() {
  const { data, isLoading, error, refetch } = useAgents();

  if (isLoading) return <TableSkeleton />;
  if (error) return <ErrorMessage error={error} onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState message="No agents registered" />;

  const online = data.filter((a) => a.status === 'online').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SNMP Agents</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {online}/{data.length} online &middot; Auto-refreshes every 30s
        </span>
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search agents..."
        exportFilename="agents"
      />
    </div>
  );
}
