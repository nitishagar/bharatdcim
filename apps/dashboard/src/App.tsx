import { useEffect } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth, useOrganization } from '@clerk/clerk-react';
import { Routes, Route } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { setTokenGetter } from './api/client';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Meters } from './pages/Meters';
import { MeterDetail } from './pages/MeterDetail';
import { Billing } from './pages/Billing';
import { BillDetail } from './pages/BillDetail';
import { Invoices } from './pages/Invoices';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Uploads } from './pages/Uploads';
import { Agents } from './pages/Agents';
import { Tariffs } from './pages/Tariffs';
import { Settings } from './pages/Settings';
import { PlatformOverview } from './pages/PlatformOverview';
import { PlatformTenants } from './pages/PlatformTenants';

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
            <Route path="platform" element={<PlatformOverview />} />
            <Route path="platform/tenants" element={<PlatformTenants />} />
          </Route>
        </Routes>
      </SignedIn>
    </>
  );
}
