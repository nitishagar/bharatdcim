import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { Routes, Route } from 'react-router-dom';
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

export function App() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
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
          </Route>
        </Routes>
      </SignedIn>
    </>
  );
}
