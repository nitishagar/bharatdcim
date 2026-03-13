import { useParams } from 'react-router-dom';
import { useBill } from '../api/hooks/useBills';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatusBadge } from '../components/StatusBadge';
import { Breadcrumb } from '../components/Breadcrumb';
import { formatPaisa } from '../lib/formatCurrency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bill, isLoading, error } = useBill(id!);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!bill) return null;

  const breakdownData = [
    { name: 'Peak', amount: bill.peakChargesPaisa / 100 },
    { name: 'Normal', amount: bill.normalChargesPaisa / 100 },
    { name: 'Off-Peak', amount: bill.offPeakChargesPaisa / 100 },
    { name: 'Wheeling', amount: bill.wheelingChargesPaisa / 100 },
    { name: 'Demand', amount: bill.demandChargesPaisa / 100 },
    { name: 'FAC', amount: bill.fuelAdjustmentPaisa / 100 },
    { name: 'Duty', amount: bill.electricityDutyPaisa / 100 },
    { name: 'PF Penalty', amount: bill.pfPenaltyPaisa / 100 },
    { name: 'DG', amount: bill.dgChargesPaisa / 100 },
    { name: 'GST', amount: bill.gstPaisa / 100 },
  ].filter((d) => d.amount > 0);

  const lineItems = [
    ['Peak Energy Charges', bill.peakChargesPaisa],
    ['Normal Energy Charges', bill.normalChargesPaisa],
    ['Off-Peak Energy Charges', bill.offPeakChargesPaisa],
    ['Wheeling Charges', bill.wheelingChargesPaisa],
    ['Demand Charges', bill.demandChargesPaisa],
    ['Fuel Adjustment', bill.fuelAdjustmentPaisa],
    ['Electricity Duty', bill.electricityDutyPaisa],
    ['PF Penalty', bill.pfPenaltyPaisa],
    ['DG Charges', bill.dgChargesPaisa],
    ['Subtotal', bill.subtotalPaisa],
    ['GST (18%)', bill.gstPaisa],
    ['Total', bill.totalBillPaisa],
  ] as const;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Billing', to: '/billing' }, { label: 'Bill Detail' }]} />
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bill Detail</h2>
        <StatusBadge status={bill.status} />
        <button
          onClick={() => window.print()}
          className="ml-auto rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 print:hidden"
        >
          Print / Save PDF
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Meter</span>
          <p className="font-medium dark:text-gray-200">{bill.meterId}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Period</span>
          <p className="font-medium dark:text-gray-200">{bill.billingPeriodStart} – {bill.billingPeriodEnd}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total kWh</span>
          <p className="font-medium dark:text-gray-200">{bill.totalKwh.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Effective Rate</span>
          <p className="font-medium dark:text-gray-200">{formatPaisa(bill.effectiveRatePaisaPerKwh)}/kWh</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Charge Breakdown</h3>
          <div className="bg-white rounded-lg border p-4 dark:bg-gray-800 dark:border-gray-700" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
                <Bar dataKey="amount" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Line Items</h3>
          <div className="bg-white rounded-lg border overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <table className="w-full text-sm">
              <tbody>
                {lineItems.map(([label, paisa], i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-100 dark:border-gray-700 ${
                      label === 'Subtotal' || label === 'Total' ? 'font-semibold bg-gray-50 dark:bg-gray-700' : ''
                    }`}
                  >
                    <td className="px-4 py-2 dark:text-gray-300">{label}</td>
                    <td className="px-4 py-2 text-right dark:text-gray-300">{formatPaisa(paisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
