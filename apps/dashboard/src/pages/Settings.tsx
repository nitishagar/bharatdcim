import { useState, useEffect } from 'react';
import { UserProfile, useOrganization } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.bharatdcim.com';

export function Settings() {
  const { organization, memberships } = useOrganization({ memberships: true });
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => setApiStatus(r.ok ? 'ok' : 'error'))
      .catch(() => setApiStatus('error'));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Clerk UserProfile — handles name, photo, password, 2FA, sessions */}
        <UserProfile routing="hash" />

        {/* Organization section */}
        {organization && (
          <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Organization</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="text-gray-900 dark:text-gray-100">{organization.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">ID</dt>
                <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs">{organization.id}</dd>
              </div>
              {memberships?.count !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Members</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{memberships.count}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* API Status */}
        <div className="max-w-lg rounded-xl border border-gray-200 bg-white p-5 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">API Connection</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Authenticated via Clerk session token. No manual configuration needed.
          </p>
          <div className="flex items-center gap-2 text-sm">
            {apiStatus === 'checking' && (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-amber-700 dark:text-amber-400">Checking...</span>
              </>
            )}
            {apiStatus === 'ok' && (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-700 dark:text-green-400">Connected — {API_BASE}</span>
              </>
            )}
            {apiStatus === 'error' && (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-700 dark:text-red-400">Cannot reach API</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
