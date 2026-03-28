import { useState } from 'react';
import {
  useNotificationConfigs,
  useCreateNotification,
  useTestNotification,
  useDeleteNotification,
  type NotificationConfig,
} from '../api/hooks/useNotifications';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { Skeleton } from '../components/Skeleton';

const VALID_EVENTS = ['capacity_warning', 'capacity_critical', 'sla_warning', 'sla_breach'] as const;
type ValidEvent = (typeof VALID_EVENTS)[number];

function TestButton({ id }: { id: string }) {
  const testNotification = useTestNotification(id);
  return (
    <button
      type="button"
      onClick={() => testNotification.mutate()}
      disabled={testNotification.isPending}
      className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      {testNotification.isPending ? 'Sending...' : 'Test'}
    </button>
  );
}

function ChannelRow({ config }: { config: NotificationConfig }) {
  const deleteNotification = useDeleteNotification();
  const events: string[] = (() => { try { return JSON.parse(config.eventsJson); } catch { return []; } })();

  return (
    <div className="flex items-start justify-between p-4 bg-white rounded-lg border dark:bg-gray-800 dark:border-gray-700">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-800 dark:text-gray-200">{config.name}</span>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {config.type}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            config.status === 'active'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {config.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{config.destination}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{events.join(', ')}</p>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <TestButton id={config.id} />
        <button
          type="button"
          onClick={() => deleteNotification.mutate(config.id)}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AddChannelForm({ onClose }: { onClose: () => void }) {
  const createNotification = useCreateNotification();
  const [name, setName] = useState('');
  const [type, setType] = useState<'email' | 'webhook'>('email');
  const [destination, setDestination] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<ValidEvent[]>([]);

  function toggleEvent(evt: ValidEvent) {
    setSelectedEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createNotification.mutateAsync({ name, type, destination, events: selectedEvents });
      onClose();
    } catch {
      // error handled by toast
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700"
    >
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Notification Channel</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
        <div>
          <label htmlFor="channel-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select
            id="channel-type"
            value={type}
            onChange={(e) => { setType(e.target.value as typeof type); setDestination(''); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
          </select>
        </div>
      </div>
      {type === 'email' ? (
        <div>
          <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
          <input
            id="email-address"
            type="email"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
      ) : (
        <div>
          <label htmlFor="webhook-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
          <input
            id="webhook-url"
            type="url"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            required
          />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Events</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VALID_EVENTS.map((evt) => (
            <label key={evt} htmlFor={`event-${evt}`} className="flex items-center gap-2 text-sm dark:text-gray-200">
              <input
                id={`event-${evt}`}
                type="checkbox"
                checked={selectedEvents.includes(evt)}
                onChange={() => toggleEvent(evt)}
                aria-label={evt}
              />
              {evt}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={createNotification.isPending}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        >
          {createNotification.isPending ? 'Saving...' : 'Add Channel'}
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

export function NotificationSettings() {
  const isAdmin = useIsAdmin();
  const [showAddForm, setShowAddForm] = useState(false);
  const { data: configs, isLoading } = useNotificationConfigs();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notification Channels</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Add Channel
          </button>
        )}
      </div>

      {showAddForm && <AddChannelForm onClose={() => setShowAddForm(false)} />}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !configs || configs.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No notification channels configured.</p>
      ) : (
        <div className="space-y-3">
          {configs.map((c) => <ChannelRow key={c.id} config={c} />)}
        </div>
      )}
    </div>
  );
}
