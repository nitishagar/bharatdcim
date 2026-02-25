import { useUser } from '@clerk/clerk-react';

export function Settings() {
  const { user } = useUser();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      <div className="max-w-lg space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Account</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-900">{user?.primaryEmailAddress?.emailAddress ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="text-gray-900">{user?.fullName ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">API Connection</h3>
          <p className="text-sm text-gray-500">
            Authenticated via Clerk session token. No manual configuration needed.
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            <span className="text-green-700">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
