import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInvoice, useCancelInvoice, useCreateCreditNote } from '../api/hooks/useInvoices';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatusBadge } from '../components/StatusBadge';
import { formatPaisa } from '../lib/formatCurrency';

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id!);
  const cancelInvoice = useCancelInvoice();
  const createCreditNote = useCreateCreditNote();

  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!invoice) return null;

  async function handleCancel() {
    await cancelInvoice.mutateAsync({ id: id!, reason: cancelReason });
    setShowCancel(false);
  }

  async function handleCreditNote() {
    await createCreditNote.mutateAsync({
      invoiceId: id!,
      amountPaisa: Math.round(parseFloat(creditAmount) * 100),
      reason: creditReason,
    });
    setShowCreditNote(false);
  }

  const taxRows = invoice.taxType === 'CGST_SGST'
    ? [
        ['CGST (9%)', invoice.cgstPaisa ?? 0],
        ['SGST (9%)', invoice.sgstPaisa ?? 0],
      ]
    : [['IGST (18%)', invoice.igstPaisa ?? 0]];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h2>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Bill ID</span>
          <p className="font-medium text-sm">{invoice.billId}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Supplier GSTIN</span>
          <p className="font-medium text-sm">{invoice.supplierGstin}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Recipient GSTIN</span>
          <p className="font-medium text-sm">{invoice.recipientGstin}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <span className="text-xs text-gray-500">Invoice Date</span>
          <p className="font-medium text-sm">{invoice.invoiceDate}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-600">Taxable Amount</td>
              <td className="px-4 py-2 text-right">{formatPaisa(invoice.taxableAmountPaisa)}</td>
            </tr>
            {taxRows.map(([label, paisa], i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-600">{label}</td>
                <td className="px-4 py-2 text-right">{formatPaisa(paisa as number)}</td>
              </tr>
            ))}
            <tr className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-600">Total Tax</td>
              <td className="px-4 py-2 text-right">{formatPaisa(invoice.totalTaxPaisa)}</td>
            </tr>
            <tr className="bg-gray-50 font-semibold">
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
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Cancel Invoice
          </button>
          <button
            onClick={() => setShowCreditNote(!showCreditNote)}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
          >
            Credit Note
          </button>
        </div>
      )}

      {showCancel && (
        <div className="mt-4 bg-white rounded-lg border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Reason</label>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2"
          />
          <button
            onClick={handleCancel}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            disabled={cancelInvoice.isPending || !cancelReason}
          >
            Confirm Cancel
          </button>
        </div>
      )}

      {showCreditNote && (
        <div className="mt-4 bg-white rounded-lg border p-4 space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreditNote}
            className="rounded-lg bg-navy px-4 py-2 text-sm text-white hover:bg-navy-light"
            disabled={createCreditNote.isPending || !creditAmount || !creditReason}
          >
            Issue Credit Note
          </button>
        </div>
      )}
    </div>
  );
}
