import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBills, useCalculateBill, useSaveBill, type Bill } from '../api/hooks/useBills';
import { useMeters, type Meter } from '../api/hooks/useMeters';
import { useTariffs, type Tariff } from '../api/hooks/useTariffs';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';

const columns: Column<Bill>[] = [
  { header: 'Period', accessor: (b) => `${b.billingPeriodStart} – ${b.billingPeriodEnd}` },
  { header: 'Meter', accessor: (b) => b.meterId },
  { header: 'kWh', accessor: (b) => b.totalKwh.toLocaleString('en-IN') },
  { header: 'Amount', accessor: (b) => formatPaisa(b.totalBillPaisa) },
  { header: 'Status', accessor: (b) => <StatusBadge status={b.status} /> },
];

/** Convert DB tariff row to billing engine TariffConfig format */
function toTariffConfig(t: Tariff) {
  const timeSlots = t.timeSlotsJson ? JSON.parse(t.timeSlotsJson) as Array<{
    name: string; startHour: number; startMinute: number;
    endHour: number; endMinute: number; type: string;
    multiplierBps: number; adderPaisa: number;
  }> : [];

  return {
    id: t.id,
    stateCode: t.stateCode,
    discom: t.discom,
    category: t.category,
    effectiveFrom: t.effectiveFrom,
    effectiveTo: t.effectiveTo,
    billingUnit: t.billingUnit,
    baseEnergyRatePaisa: t.baseEnergyRatePaisa,
    wheelingChargePaisa: t.wheelingChargePaisa,
    demandChargePerKVAPaisa: t.demandChargePerKvaPaisa,
    demandRatchetPercent: t.demandRatchetPercent,
    minimumDemandKVA: t.minimumDemandKva,
    timeSlots,
    fuelAdjustmentPaisa: t.fuelAdjustmentPaisa,
    fuelAdjustmentType: t.fuelAdjustmentType,
    electricityDutyBps: t.electricityDutyBps,
    pfThresholdBps: t.pfThresholdBps,
    pfPenaltyRatePaisa: t.pfPenaltyRatePaisa,
    version: t.version,
  };
}

/** Compute rate for a slot type from tariff time slots */
function getSlotRate(tariff: Tariff, slotType: string): number {
  const slots = tariff.timeSlotsJson ? JSON.parse(tariff.timeSlotsJson) as Array<{
    type: string; multiplierBps: number; adderPaisa: number;
  }> : [];
  const slot = slots.find((s) => s.type === slotType);
  if (!slot) return tariff.baseEnergyRatePaisa;
  return Math.round(tariff.baseEnergyRatePaisa * slot.multiplierBps / 10000) + slot.adderPaisa;
}

export function Billing() {
  const { data, isLoading, error, refetch } = useBills();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        >
          Calculate Bill
        </button>
      </div>

      {showForm && (
        <CalculateBillForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState message="No bills found" />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(b) => navigate(`/billing/${b.id}`)}
        />
      )}
    </div>
  );
}

function CalculateBillForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: meters } = useMeters();
  const { data: tariffs } = useTariffs();
  const calculateBill = useCalculateBill();
  const saveBill = useSaveBill();

  const [meterId, setMeterId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [peakKwh, setPeakKwh] = useState('');
  const [normalKwh, setNormalKwh] = useState('');
  const [offPeakKwh, setOffPeakKwh] = useState('');
  const [contractedDemandKva, setContractedDemandKva] = useState('');
  const [recordedDemandKva, setRecordedDemandKva] = useState('');
  const [powerFactor, setPowerFactor] = useState('0.95');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const selectedMeter = meters?.find((m: Meter) => m.id === meterId);
  const selectedTariff = tariffs?.find((t: Tariff) => t.id === selectedMeter?.tariffId);

  async function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTariff) return;

    const readings = [
      {
        timestamp: periodStart,
        kWh: parseFloat(peakKwh) || 0,
        slotName: 'Peak',
        slotType: 'peak' as const,
        ratePaisa: getSlotRate(selectedTariff, 'peak'),
      },
      {
        timestamp: periodStart,
        kWh: parseFloat(normalKwh) || 0,
        slotName: 'Normal',
        slotType: 'normal' as const,
        ratePaisa: getSlotRate(selectedTariff, 'normal'),
      },
      {
        timestamp: periodStart,
        kWh: parseFloat(offPeakKwh) || 0,
        slotName: 'Off-Peak',
        slotType: 'off-peak' as const,
        ratePaisa: getSlotRate(selectedTariff, 'off-peak'),
      },
    ].filter((r) => r.kWh > 0);

    const data = {
      readings,
      tariff: toTariffConfig(selectedTariff),
      contractedDemandKVA: parseFloat(contractedDemandKva) || 0,
      recordedDemandKVA: parseFloat(recordedDemandKva) || 0,
      powerFactor: parseFloat(powerFactor) || 0.95,
    };

    try {
      const res = await calculateBill.mutateAsync(data);
      setResult(res);
    } catch {
      // error handled by mutation state
    }
  }

  async function handleSave() {
    if (!result || !selectedMeter || !selectedTariff) return;

    const id = crypto.randomUUID();
    const billData = {
      id,
      tenantId: selectedMeter.tenantId,
      meterId: selectedMeter.id,
      tariffId: selectedTariff.id,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      peakKwh: (result as Record<string, number>).peakKWh ?? 0,
      normalKwh: (result as Record<string, number>).normalKWh ?? 0,
      offPeakKwh: (result as Record<string, number>).offPeakKWh ?? 0,
      totalKwh: (result as Record<string, number>).totalKWh ?? 0,
      billedKvah: (result as Record<string, number | null>).billedKVAh ?? null,
      contractedDemandKva: parseFloat(contractedDemandKva) || 0,
      recordedDemandKva: parseFloat(recordedDemandKva) || 0,
      billedDemandKva: (result as Record<string, number>).billedDemandKVA ?? 0,
      powerFactor: parseFloat(powerFactor) || 0.95,
      peakChargesPaisa: (result as Record<string, number>).peakChargesPaisa ?? 0,
      normalChargesPaisa: (result as Record<string, number>).normalChargesPaisa ?? 0,
      offPeakChargesPaisa: (result as Record<string, number>).offPeakChargesPaisa ?? 0,
      totalEnergyChargesPaisa: (result as Record<string, number>).totalEnergyChargesPaisa ?? 0,
      wheelingChargesPaisa: (result as Record<string, number>).wheelingChargesPaisa ?? 0,
      demandChargesPaisa: (result as Record<string, number>).demandChargesPaisa ?? 0,
      fuelAdjustmentPaisa: (result as Record<string, number>).fuelAdjustmentPaisa ?? 0,
      electricityDutyPaisa: (result as Record<string, number>).electricityDutyPaisa ?? 0,
      pfPenaltyPaisa: (result as Record<string, number>).pfPenaltyPaisa ?? 0,
      dgChargesPaisa: (result as Record<string, number>).dgChargesPaisa ?? 0,
      subtotalPaisa: (result as Record<string, number>).subtotalPaisa ?? 0,
      gstPaisa: (result as Record<string, number>).gstPaisa ?? 0,
      totalBillPaisa: (result as Record<string, number>).totalBillPaisa ?? 0,
      effectiveRatePaisaPerKwh: (result as Record<string, number>).effectiveRatePaisaPerKWh ?? 0,
      status: 'draft',
    };

    try {
      await saveBill.mutateAsync(billData);
      onSaved();
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4 mb-4 space-y-4">
      <form onSubmit={handleCalculate} className="space-y-3">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meter</label>
            <select
              value={meterId}
              onChange={(e) => { setMeterId(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select meter...</option>
              {meters?.map((m: Meter) => (
                <option key={m.id} value={m.id}>{m.name} ({m.stateCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        {selectedTariff && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Tariff: {selectedTariff.stateCode} — {selectedTariff.discom} — {selectedTariff.category}
            {' '}(Base rate: {formatPaisa(selectedTariff.baseEnergyRatePaisa)}/kWh)
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Peak kWh</label>
            <input
              type="number"
              step="0.01"
              value={peakKwh}
              onChange={(e) => { setPeakKwh(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Normal kWh</label>
            <input
              type="number"
              step="0.01"
              value={normalKwh}
              onChange={(e) => { setNormalKwh(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Off-Peak kWh</label>
            <input
              type="number"
              step="0.01"
              value={offPeakKwh}
              onChange={(e) => { setOffPeakKwh(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contracted Demand (KVA)</label>
            <input
              type="number"
              step="0.01"
              value={contractedDemandKva}
              onChange={(e) => { setContractedDemandKva(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recorded Demand (KVA)</label>
            <input
              type="number"
              step="0.01"
              value={recordedDemandKva}
              onChange={(e) => { setRecordedDemandKva(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Power Factor</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={powerFactor}
              onChange={(e) => { setPowerFactor(e.target.value); setResult(null); }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
            disabled={calculateBill.isPending || !meterId || !selectedTariff}
          >
            {calculateBill.isPending ? 'Calculating...' : 'Calculate'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>

        {calculateBill.error && (
          <p className="text-sm text-red-600">{calculateBill.error.message}</p>
        )}

        {!selectedTariff && meterId && (
          <p className="text-sm text-amber-600">
            No tariff configured for this meter. Assign a tariff first.
          </p>
        )}
      </form>

      {result && (
        <BillPreview
          result={result}
          onSave={handleSave}
          saving={saveBill.isPending}
          saveError={saveBill.error}
        />
      )}
    </div>
  );
}

function BillPreview({
  result,
  onSave,
  saving,
  saveError,
}: {
  result: Record<string, unknown>;
  onSave: () => void;
  saving: boolean;
  saveError: Error | null;
}) {
  const r = result as Record<string, number>;

  const lineItems = [
    ['Peak Energy Charges', r.peakChargesPaisa],
    ['Normal Energy Charges', r.normalChargesPaisa],
    ['Off-Peak Energy Charges', r.offPeakChargesPaisa],
    ['Wheeling Charges', r.wheelingChargesPaisa],
    ['Demand Charges', r.demandChargesPaisa],
    ['Fuel Adjustment', r.fuelAdjustmentPaisa],
    ['Electricity Duty', r.electricityDutyPaisa],
    ['PF Penalty', r.pfPenaltyPaisa],
    ['DG Charges', r.dgChargesPaisa],
    ['Subtotal', r.subtotalPaisa],
    ['GST (18%)', r.gstPaisa],
  ].filter(([, v]) => (v as number) > 0);

  return (
    <div className="border-t pt-4">
      <h4 className="text-sm font-semibold text-gray-800 mb-2">Bill Preview</h4>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div className="rounded-lg bg-gray-50 p-3">
          <span className="text-xs text-gray-500">Total kWh</span>
          <p className="font-semibold">{(r.totalKWh ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <span className="text-xs text-gray-500">Effective Rate</span>
          <p className="font-semibold">{formatPaisa(r.effectiveRatePaisaPerKWh ?? 0)}/kWh</p>
        </div>
        <div className="rounded-lg bg-burgundy/10 p-3">
          <span className="text-xs text-burgundy">Total Bill</span>
          <p className="font-bold text-burgundy">{formatPaisa(r.totalBillPaisa ?? 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden mb-3">
        <table className="w-full text-sm">
          <tbody>
            {lineItems.map(([label, paisa], i) => (
              <tr key={i} className={`border-b border-gray-100 ${label === 'Subtotal' ? 'font-semibold bg-gray-50' : ''}`}>
                <td className="px-4 py-1.5 text-gray-600">{label as string}</td>
                <td className="px-4 py-1.5 text-right">{formatPaisa(paisa as number)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right">{formatPaisa(r.totalBillPaisa ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        onClick={onSave}
        className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Bill'}
      </button>

      {saveError && <p className="text-sm text-red-600 mt-1">{saveError.message}</p>}
    </div>
  );
}
