import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';

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

export function Layout() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — matches marketing site navy palette */}
      <aside className="w-56 bg-gradient-to-b from-navy to-[#162d4a] text-white flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center gap-2">
          <span className="text-lg font-bold text-white">Bharat</span>
          <span className="text-lg font-bold text-rose">DCIM</span>
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
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
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
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          <UserButton />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
