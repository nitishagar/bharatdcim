import { lazy, Suspense, useEffect } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth, useOrganization } from '@clerk/clerk-react';
import { Routes, Route } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { setTokenGetter } from './api/client';
import { Layout } from './components/Layout';
import { RequirePlatformAdmin } from './components/RequirePlatformAdmin';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardSkeleton } from './components/Skeleton';

// Route-level code splitting — each page loads on demand
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Meters = lazy(() => import('./pages/Meters').then(m => ({ default: m.Meters })));
const MeterDetail = lazy(() => import('./pages/MeterDetail').then(m => ({ default: m.MeterDetail })));
const Billing = lazy(() => import('./pages/Billing').then(m => ({ default: m.Billing })));
const BillDetail = lazy(() => import('./pages/BillDetail').then(m => ({ default: m.BillDetail })));
const Invoices = lazy(() => import('./pages/Invoices').then(m => ({ default: m.Invoices })));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail').then(m => ({ default: m.InvoiceDetail })));
const Uploads = lazy(() => import('./pages/Uploads').then(m => ({ default: m.Uploads })));
const Agents = lazy(() => import('./pages/Agents').then(m => ({ default: m.Agents })));
const Tariffs = lazy(() => import('./pages/Tariffs').then(m => ({ default: m.Tariffs })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const PlatformOverview = lazy(() => import('./pages/PlatformOverview').then(m => ({ default: m.PlatformOverview })));
const PlatformTenants = lazy(() => import('./pages/PlatformTenants').then(m => ({ default: m.PlatformTenants })));

/** Wires Clerk's session token into the API client */
function AuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  return null;
}

/** Invalidates all TanStack Query caches when the active org changes */
function OrgBridge() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries();
  }, [organization?.id, queryClient]);

  return null;
}

export function App() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <AuthBridge />
        <OrgBridge />
        <Toaster position="top-right" richColors />
        <ErrorBoundary>
          <Suspense fallback={<DashboardSkeleton />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="meters" element={<Meters />} />
                <Route path="meters/:id" element={<MeterDetail />} />
                <Route path="billing" element={<Billing />} />
                <Route path="billing/:id" element={<BillDetail />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="invoices/:id" element={<InvoiceDetail />} />
                <Route path="uploads" element={<Uploads />} />
                <Route path="agents" element={<Agents />} />
                <Route path="tariffs" element={<Tariffs />} />
                <Route path="settings" element={<Settings />} />
                <Route path="platform" element={<RequirePlatformAdmin><PlatformOverview /></RequirePlatformAdmin>} />
                <Route path="platform/tenants" element={<RequirePlatformAdmin><PlatformTenants /></RequirePlatformAdmin>} />
              </Route>
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </SignedIn>
    </>
  );
}
