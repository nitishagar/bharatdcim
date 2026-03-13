import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useInvoices, useCreateInvoice, type Invoice } from '../api/hooks/useInvoices';
import { useBills, type Bill } from '../api/hooks/useBills';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { createInvoiceSchema, type CreateInvoiceForm } from '../lib/schemas';

const columns: ColumnDef<Invoice, unknown>[] = [
  { accessorKey: 'invoiceNumber', header: 'Invoice #' },
  { accessorKey: 'tenantId', header: 'Tenant' },
  { id: 'amount', header: 'Amount', accessorFn: (inv) => inv.totalAmountPaisa, cell: ({ row }) => formatPaisa(row.original.totalAmountPaisa) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} />, enableSorting: false },
  { accessorKey: 'invoiceDate', header: 'Date' },
];

export function Invoices() {
  const { data, isLoading, error, refetch } = useInvoices();
  const { data: bills } = useBills();
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const isAdmin = useIsAdmin();
  const [showForm, setShowForm] = useState(false);
  const uninvoicedBills = bills?.filter((b: Bill) => b.status !== 'invoiced') ?? [];

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateInvoiceForm>({
    resolver: zodResolver(createInvoiceSchema),
  });

  async function onSubmit(formData: CreateInvoiceForm) {
    try {
      await createInvoice.mutateAsync(formData);
      setShowForm(false);
      reset();
    } catch {
      // error handled by toast
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Invoices</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Generate Invoice
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border p-4 mb-4 space-y-3 dark:bg-gray-800 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bill</label>
            <select
              {...register('billId')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="">Select a bill...</option>
              {uninvoicedBills.map((b: Bill) => (
                <option key={b.id} value={b.id}>
                  {b.billingPeriodStart} – {b.billingPeriodEnd} | {b.meterId} | {formatPaisa(b.totalBillPaisa)}
                </option>
              ))}
            </select>
            {errors.billId && <p className="mt-1 text-sm text-red-500">{errors.billId.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier GSTIN</label>
              <input
                {...register('supplierGSTIN')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="e.g., 29ABCDE1234F1Z5"
              />
              {errors.supplierGSTIN && <p className="mt-1 text-sm text-red-500">{errors.supplierGSTIN.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient GSTIN</label>
              <input
                {...register('recipientGSTIN')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="e.g., 29ABCDE1234F1Z5"
              />
              {errors.recipientGSTIN && <p className="mt-1 text-sm text-red-500">{errors.recipientGSTIN.message}</p>}
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
          searchPlaceholder="Search invoices..."
          exportFilename="invoices"
        />
      )}
    </div>
  );
}
