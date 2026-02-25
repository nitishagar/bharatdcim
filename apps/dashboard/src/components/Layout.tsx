import { useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { getApiToken, setApiToken } from '../api/client';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '◎' },
  { to: '/meters', label: 'Meters', icon: '⚡' },
  { to: '/billing', label: 'Billing', icon: '₹' },
  { to: '/invoices', label: 'Invoices', icon: '📄' },
  { to: '/uploads', label: 'Uploads', icon: '📁' },
  { to: '/agents', label: 'Agents', icon: '🔌' },
  { to: '/tariffs', label: 'Tariffs', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

const TITLE_MAP: Record<string, string> = {
  '/': 'Overview',
  '/meters': 'Meters',
  '/billing': 'Billing',
  '/invoices': 'Invoices',
  '/uploads': 'Uploads',
  '/agents': 'SNMP Agents',
  '/tariffs': 'Tariffs',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith('/meters/')) return 'Meter Detail';
  if (pathname.startsWith('/billing/')) return 'Bill Detail';
  if (pathname.startsWith('/invoices/')) return 'Invoice Detail';
  return 'Dashboard';
}

function WelcomeSetup() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleConnect() {
    if (!token.trim()) {
      setError('Please enter your API token.');
      return;
    }
    setApiToken(token.trim());
    navigate(0); // reload to pick up token
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">Welcome to BharatDCIM</div>
          <p className="text-gray-500">
            Connect your API to start managing meters, billing, and invoices.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Connect your API</h3>
          <p className="text-xs text-gray-500 mb-4">
            Enter the Bearer token from your BharatDCIM API deployment.
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Bearer Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => { setToken(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-navy focus:ring-1 focus:ring-navy outline-none"
            placeholder="Paste your API token here"
            autoFocus
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

          <button
            onClick={handleConnect}
            className="mt-4 w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-light transition-colors"
          >
            Connect
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Your token is stored locally in this browser and never sent to third parties.
        </p>
      </div>
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const hasToken = !!getApiToken();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-navy text-white flex flex-col">
        <div className="p-4 text-lg font-bold border-b border-navy-light">
          BharatDCIM
        </div>
        <nav className="flex-1 py-2">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-navy-light text-white font-medium'
                    : 'text-gray-300 hover:bg-navy-light/50 hover:text-white'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          <UserButton />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {!hasToken && pathname !== '/settings' ? (
            <WelcomeSetup />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
