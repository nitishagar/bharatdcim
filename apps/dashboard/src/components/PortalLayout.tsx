import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { UserButton, useOrganization } from '@clerk/clerk-react';
import { DarkModeToggle } from './DarkModeToggle';

const PORTAL_NAV_ITEMS = [
  { to: '/portal/meters', label: 'Meters', icon: '⚡' },
  { to: '/portal/billing', label: 'Bills', icon: '₹' },
  { to: '/portal/invoices', label: 'Invoices', icon: '📄' },
  { to: '/portal/settings', label: 'Settings', icon: '⚙' },
];

const TITLE_MAP: Record<string, string> = {
  '/portal': 'Portal',
  '/portal/meters': 'Meters',
  '/portal/billing': 'Bills',
  '/portal/invoices': 'Invoices',
  '/portal/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith('/portal/billing/')) return 'Bill Detail';
  if (pathname.startsWith('/portal/invoices/')) return 'Invoice Detail';
  if (pathname.startsWith('/portal/meters/')) return 'Meter Detail';
  return 'Portal';
}

function NavItem({ to, label, icon, onClick }: { to: string; label: string; icon: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
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
  );
}

export function PortalLayout() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const { organization } = useOrganization();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        data-open={sidebarOpen}
        className="fixed inset-y-0 left-0 z-40 w-56 bg-gradient-to-b from-navy to-[#162d4a] text-white flex flex-col -translate-x-full transition-transform duration-300 data-[open=true]:translate-x-0 lg:relative lg:translate-x-0"
      >
        <div className="p-3 border-b border-white/10">
          <div className="text-white font-medium text-sm px-2 py-1.5 truncate">
            {organization?.name ?? 'Portal'}
          </div>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {PORTAL_NAV_ITEMS.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} onClick={closeSidebar} />
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-1.5 -ml-1 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <UserButton />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
