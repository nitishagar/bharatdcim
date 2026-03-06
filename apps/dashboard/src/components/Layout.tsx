import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { UserButton, OrganizationSwitcher, useAuth } from '@clerk/clerk-react';

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

function usePlatformAdmin(): boolean {
  const { sessionClaims } = useAuth();
  return (sessionClaims as Record<string, unknown> | null)?.platformAdmin === true
    || (sessionClaims as Record<string, unknown> | null)?.platformAdmin === 'true';
}

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar — matches marketing site navy palette */}
      <aside className="w-56 bg-gradient-to-b from-navy to-[#162d4a] text-white flex flex-col">
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
            <NavItem key={to} to={to} label={label} icon={icon} end={to === '/'} />
          ))}
          {isPlatformAdmin && (
            <>
              <div className="mx-4 my-2 border-t border-white/10" />
              <div className="px-4 py-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
                Platform
              </div>
              {PLATFORM_NAV_ITEMS.map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} end={to === '/platform'} />
              ))}
            </>
          )}
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
