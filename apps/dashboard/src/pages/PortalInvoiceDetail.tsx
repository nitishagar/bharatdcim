import { useParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { useInvoice } from '../api/hooks/useInvoices';
import { DetailSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatusBadge } from '../components/StatusBadge';
import { Breadcrumb } from '../components/Breadcrumb';
import { InvoicePDF } from '../components/InvoicePDF';
import { formatPaisa } from '../lib/formatCurrency';

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

export function PortalInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id!);

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

  const taxRows = invoice.taxType === 'CGST_SGST'
    ? [
        ['CGST (9%)', invoice.cgstPaisa ?? 0],
        ['SGST (9%)', invoice.sgstPaisa ?? 0],
      ]
    : [['IGST (18%)', invoice.igstPaisa ?? 0]];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Invoices', to: '/portal/invoices' }, { label: invoice.invoiceNumber }]} />
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
    </div>
  );
}
