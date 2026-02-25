import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoices, useCreateInvoice, type Invoice } from '../api/hooks/useInvoices';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';

const columns: Column<Invoice>[] = [
  { header: 'Invoice #', accessor: (inv) => inv.invoiceNumber },
  { header: 'Tenant', accessor: (inv) => inv.tenantId },
  { header: 'Amount', accessor: (inv) => formatPaisa(inv.totalAmountPaisa) },
  { header: 'Status', accessor: (inv) => <StatusBadge status={inv.status} /> },
  { header: 'Date', accessor: (inv) => inv.invoiceDate },
];

export function Invoices() {
  const { data, isLoading, error, refetch } = useInvoices();
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();

  const [showForm, setShowForm] = useState(false);
  const [billId, setBillId] = useState('');
  const [supplierGSTIN, setSupplierGSTIN] = useState('');
  const [recipientGSTIN, setRecipientGSTIN] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createInvoice.mutateAsync({ billId, supplierGSTIN, recipientGSTIN });
      setShowForm(false);
      setBillId('');
      setSupplierGSTIN('');
      setRecipientGSTIN('');
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        >
          Generate Invoice
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border p-4 mb-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill ID</label>
            <input
              value={billId}
              onChange={(e) => setBillId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier GSTIN</label>
              <input
                value={supplierGSTIN}
                onChange={(e) => setSupplierGSTIN(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient GSTIN</label>
              <input
                value={recipientGSTIN}
                onChange={(e) => setRecipientGSTIN(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
          {createInvoice.error && <p className="text-sm text-red-600">{createInvoice.error.message}</p>}
        </form>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState message="No invoices found" />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(inv) => navigate(`/invoices/${inv.id}`)}
        />
      )}
    </div>
  );
}
