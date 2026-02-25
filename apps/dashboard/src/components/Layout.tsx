import { Outlet, NavLink } from 'react-router-dom';
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

export function Layout() {
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
          <h1 className="text-lg font-semibold text-gray-800">Dashboard</h1>
          <UserButton />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
