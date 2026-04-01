import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pdf } from '@react-pdf/renderer';
import { useInvoice, useCancelInvoice, useCreateCreditNote } from '../api/hooks/useInvoices';
import { useAuditLog } from '../api/hooks/useAuditLog';
import { DetailSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatusBadge } from '../components/StatusBadge';
import { Breadcrumb } from '../components/Breadcrumb';
import { InvoicePDF } from '../components/InvoicePDF';
import { formatPaisa } from '../lib/formatCurrency';
import { cancelInvoiceSchema, creditNoteSchema, type CancelInvoiceForm, type CreditNoteForm } from '../lib/schemas';

const IRP_STATUS_CONFIG: Record<string, { label: string; color: 'green' | 'amber' | 'red' }> = {
  irn_generated: { label: 'IRN Generated', color: 'green' },
  pending_irn: { label: 'Pending IRN', color: 'amber' },
  irn_cancelled: { label: 'IRN Cancelled', color: 'red' },
};

function IRPStatusBadge({ status }: { status: string }) {
  const config = IRP_STATUS_CONFIG[status];
  if (!config) return null;
  const colorClass = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  }[config.color];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {config.label}
    </span>
  );
}

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id!);
  const cancelInvoice = useCancelInvoice();
  const createCreditNote = useCreateCreditNote();

  const [showCancel, setShowCancel] = useState(false);
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const { data: auditEntries } = useAuditLog(id!);

  const cancelForm = useForm<CancelInvoiceForm>({
    resolver: zodResolver(cancelInvoiceSchema),
  });

  const creditForm = useForm<CreditNoteForm>({
    resolver: zodResolver(creditNoteSchema),
  });

  if (isLoading) return <DetailSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!invoice) return null;

  async function handleDownloadPDF() {
    const blob = await pdf(
      <InvoicePDF
        invoiceNumber={invoice!.invoiceNumber}
        invoiceDate={invoice!.invoiceDate}
        supplierGstin={invoice!.supplierGstin}
        recipientGstin={invoice!.recipientGstin}
        taxType={invoice!.taxType}
        taxableAmountPaisa={invoice!.taxableAmountPaisa}
        cgstPaisa={invoice!.cgstPaisa}
        sgstPaisa={invoice!.sgstPaisa}
        igstPaisa={invoice!.igstPaisa}
        totalTaxPaisa={invoice!.totalTaxPaisa}
        totalAmountPaisa={invoice!.totalAmountPaisa}
        status={invoice!.status}
        financialYear={invoice!.financialYear}
        eInvoiceStatus={invoice!.eInvoiceStatus}
        irn={invoice!.irn}
        ackNo={invoice!.ackNo}
        ackDt={invoice!.ackDt}
        qrCodeDataUrl={invoice!.signedQrCode}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice!.invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCancel(data: CancelInvoiceForm) {
    await cancelInvoice.mutateAsync({ id: id!, reason: data.reason });
    setShowCancel(false);
    cancelForm.reset();
  }

  async function handleCreditNote(data: CreditNoteForm) {
    await createCreditNote.mutateAsync({
      invoiceId: id!,
      amountPaisa: Math.round(parseFloat(data.amount) * 100),
      reason: data.reason,
    });
    setShowCreditNote(false);
    creditForm.reset();
  }

  const taxRows = invoice.taxType === 'CGST_SGST'
    ? [
        ['CGST (9%)', invoice.cgstPaisa ?? 0],
        ['SGST (9%)', invoice.sgstPaisa ?? 0],
      ]
    : [['IGST (18%)', invoice.igstPaisa ?? 0]];

  const showIrpCancelWarning =
    invoice.status === 'cancelled' && invoice.eInvoiceStatus !== 'irn_cancelled';

  return (
    <div>
      <Breadcrumb items={[{ label: 'Invoices', to: '/invoices' }, { label: invoice.invoiceNumber }]} />
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</h2>
        <StatusBadge status={invoice.status} />
        {invoice.eInvoiceStatus !== 'not_applicable' && (
          <IRPStatusBadge status={invoice.eInvoiceStatus} />
        )}
        <button
          onClick={handleDownloadPDF}
          className="ml-auto rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 print:hidden dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Download PDF
        </button>
      </div>

      {showIrpCancelWarning && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          IRP cancellation was not performed (outside 24h window or no IRN). Amend via GSTR-1 filing if required.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Bill ID</span>
          <p className="font-medium text-sm dark:text-gray-200">{invoice.billId}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Supplier GSTIN</span>
          <p className="font-medium text-sm dark:text-gray-200">{invoice.supplierGstin}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Recipient GSTIN</span>
          <p className="font-medium text-sm dark:text-gray-200">{invoice.recipientGstin}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Invoice Date</span>
          <p className="font-medium text-sm dark:text-gray-200">{invoice.invoiceDate}</p>
        </div>
      </div>

      {invoice.irn && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">IRN</p>
          <p className="font-mono text-xs break-all dark:text-gray-200">{invoice.irn}</p>
          {invoice.ackNo && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Ack No: {invoice.ackNo} &bull; Ack Date: {invoice.ackDt}
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden mb-6 dark:bg-gray-800 dark:border-gray-700">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Taxable Amount</td>
              <td className="px-4 py-2 text-right">{formatPaisa(invoice.taxableAmountPaisa)}</td>
            </tr>
            {taxRows.map(([label, paisa], i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{label}</td>
                <td className="px-4 py-2 text-right">{formatPaisa(paisa as number)}</td>
              </tr>
            ))}
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">Total Tax</td>
              <td className="px-4 py-2 text-right">{formatPaisa(invoice.totalTaxPaisa)}</td>
            </tr>
            <tr className="bg-gray-50 font-semibold dark:bg-gray-700">
              <td className="px-4 py-2">Total Amount</td>
              <td className="px-4 py-2 text-right">{formatPaisa(invoice.totalAmountPaisa)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invoice.status !== 'cancelled' && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowCancel(!showCancel)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Cancel Invoice
          </button>
          <button
            onClick={() => setShowCreditNote(!showCreditNote)}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Credit Note
          </button>
        </div>
      )}

      {showCancel && (
        <form onSubmit={cancelForm.handleSubmit(handleCancel)} className="mt-4 bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cancellation Reason</label>
          <select
            {...cancelForm.register('reason')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">Select reason...</option>
            <option value="Duplicate">Duplicate</option>
            <option value="Data Entry Mistake">Data Entry Mistake</option>
            <option value="Order Cancelled">Order Cancelled</option>
            <option value="Other">Other</option>
          </select>
          {cancelForm.formState.errors.reason && (
            <p className="text-sm text-red-500 mb-2">{cancelForm.formState.errors.reason.message}</p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            disabled={cancelInvoice.isPending}
          >
            {cancelInvoice.isPending ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </form>
      )}

      {showCreditNote && (
        <form onSubmit={creditForm.handleSubmit(handleCreditNote)} className="mt-4 bg-white rounded-lg border p-4 space-y-2 dark:bg-gray-800 dark:border-gray-700">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              {...creditForm.register('amount')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
            {creditForm.formState.errors.amount && (
              <p className="mt-1 text-sm text-red-500">{creditForm.formState.errors.amount.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
            <input
              {...creditForm.register('reason')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
            {creditForm.formState.errors.reason && (
              <p className="mt-1 text-sm text-red-500">{creditForm.formState.errors.reason.message}</p>
            )}
          </div>
          <button
            type="submit"
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
            disabled={createCreditNote.isPending}
          >
            {createCreditNote.isPending ? 'Issuing...' : 'Issue Credit Note'}
          </button>
        </form>
      )}

      <div className="mt-6">
        <button
          onClick={() => setShowAudit(!showAudit)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>{showAudit ? '▼' : '▶'}</span>
          Audit History
          {auditEntries && <span className="text-gray-400">({auditEntries.length})</span>}
        </button>
        {showAudit && (
          <div className="mt-2 bg-white rounded-lg border overflow-hidden">
            {!auditEntries?.length ? (
              <p className="px-4 py-3 text-sm text-gray-500">No audit entries found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Action</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Actor</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-600">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="px-4 py-2 font-medium capitalize">{entry.action.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-gray-600">{entry.actor ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{new Date(entry.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
