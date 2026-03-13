import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { UserButton, OrganizationSwitcher, useAuth } from '@clerk/clerk-react';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';
import { DarkModeToggle } from './DarkModeToggle';

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

const PLATFORM_NAV_ITEMS = [
  { to: '/platform', label: 'Platform Overview', icon: '🏢' },
  { to: '/platform/tenants', label: 'Tenants', icon: '🏗' },
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
  '/platform': 'Platform Overview',
  '/platform/tenants': 'Tenants',
};

function getPageTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith('/meters/')) return 'Meter Detail';
  if (pathname.startsWith('/billing/')) return 'Bill Detail';
  if (pathname.startsWith('/invoices/')) return 'Invoice Detail';
  return 'Dashboard';
}

function NavItem({ to, label, icon, end, onClick }: { to: string; label: string; icon: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
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

export function Layout() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const isPlatformAdmin = usePlatformAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Backdrop overlay — mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        data-open={sidebarOpen}
        className="fixed inset-y-0 left-0 z-40 w-56 bg-gradient-to-b from-navy to-[#162d4a] text-white flex flex-col -translate-x-full transition-transform duration-300 data-[open=true]:translate-x-0 lg:relative lg:translate-x-0"
      >
        <div className="p-3 border-b border-white/10">
          <OrganizationSwitcher
            hidePersonal={true}
            afterSelectOrganizationUrl="/"
            appearance={{
              elements: {
                rootBox: 'w-full',
                organizationSwitcherTrigger:
                  'w-full text-white hover:bg-white/10 rounded-md px-2 py-1.5 [&>*]:text-white [&_span]:text-white [&_p]:text-white',
                organizationPreviewMainIdentifier: 'text-white',
                organizationSwitcherTriggerIcon: 'text-white/70',
                organizationPreviewSecondaryIdentifier: 'text-white/60',
              },
            }}
          />
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={to === '/'} onClick={closeSidebar} />
          ))}
          {isPlatformAdmin && (
            <>
              <div className="mx-4 my-2 border-t border-white/10" />
              <div className="px-4 py-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
                Platform
              </div>
              {PLATFORM_NAV_ITEMS.map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} end={to === '/platform'} onClick={closeSidebar} />
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Main content */}
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
