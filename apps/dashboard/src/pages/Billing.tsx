import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBills, useCalculateBill, useSaveBill, type Bill } from '../api/hooks/useBills';
import { useMeters, type Meter } from '../api/hooks/useMeters';
import { useTariffs, type Tariff } from '../api/hooks/useTariffs';
import { useReadings, type Reading } from '../api/hooks/useReadings';
import { DataTable, type ColumnDef } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/Skeleton';
import { ErrorMessage } from '../components/ErrorMessage';
import { EmptyState } from '../components/EmptyState';
import { formatPaisa } from '../lib/formatCurrency';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { calculateBillSchema, type CalculateBillForm } from '../lib/schemas';

const columns: ColumnDef<Bill, unknown>[] = [
  { id: 'period', header: 'Period', accessorFn: (b) => `${b.billingPeriodStart} – ${b.billingPeriodEnd}` },
  { accessorKey: 'meterId', header: 'Meter' },
  { id: 'kwh', header: 'kWh', accessorFn: (b) => b.totalKwh, cell: ({ row }) => row.original.totalKwh.toLocaleString('en-IN') },
  { id: 'amount', header: 'Amount', accessorFn: (b) => b.totalBillPaisa, cell: ({ row }) => formatPaisa(row.original.totalBillPaisa) },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} />, enableSorting: false },
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
  const isAdmin = useIsAdmin();

  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing</h2>
        {isAdmin && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-burgundy px-4 py-2 text-sm text-white hover:bg-burgundy-dark"
          >
            Calculate Bill
          </button>
        )}
      </div>

      {showForm && (
        <CalculateBillFormComponent
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorMessage error={error} onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState message="No bills found" />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(b) => navigate(`/billing/${b.id}`)}
          searchPlaceholder="Search bills..."
          exportFilename="bills"
        />
      )}
    </div>
  );
}

function CalculateBillFormComponent({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: meters } = useMeters();
  const { data: tariffs } = useTariffs();
  const calculateBill = useCalculateBill();
  const saveBill = useSaveBill();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors }, getValues } = useForm<CalculateBillForm>({
    resolver: zodResolver(calculateBillSchema),
    defaultValues: {
      meterId: '', periodStart: '', periodEnd: '',
      peakKwh: '', normalKwh: '', offPeakKwh: '',
      contractedDemandKva: '', recordedDemandKva: '', powerFactor: '0.95',
    },
  });

  const meterId = watch('meterId');
  const periodStart = watch('periodStart');
  const periodEnd = watch('periodEnd');
  const selectedMeter = meters?.find((m: Meter) => m.id === meterId);
  const selectedTariff = tariffs?.find((t: Tariff) => t.id === selectedMeter?.tariffId);

  const { data: readings } = useReadings(
    meterId,
    periodStart || undefined,
    periodEnd || undefined,
  );

  useEffect(() => {
    if (!readings || !periodStart || !periodEnd) return;

    const peakKwh = readings
      .filter((r: Reading) => r.slotType === 'peak' && r.kWh !== null)
      .reduce((sum: number, r: Reading) => sum + (r.kWh ?? 0), 0);
    const normalKwh = readings
      .filter((r: Reading) => r.slotType === 'normal' && r.kWh !== null)
      .reduce((sum: number, r: Reading) => sum + (r.kWh ?? 0), 0);
    const offPeakKwh = readings
      .filter((r: Reading) => r.slotType === 'off-peak' && r.kWh !== null)
      .reduce((sum: number, r: Reading) => sum + (r.kWh ?? 0), 0);

    if (peakKwh > 0) setValue('peakKwh', peakKwh.toFixed(2));
    if (normalKwh > 0) setValue('normalKwh', normalKwh.toFixed(2));
    if (offPeakKwh > 0) setValue('offPeakKwh', offPeakKwh.toFixed(2));
  }, [readings, periodStart, periodEnd, setValue]);

  async function onCalculate(formData: CalculateBillForm) {
    if (!selectedTariff) return;

    const readings = [
      {
        timestamp: formData.periodStart,
        kWh: parseFloat(formData.peakKwh) || 0,
        slotName: 'Peak',
        slotType: 'peak' as const,
        ratePaisa: getSlotRate(selectedTariff, 'peak'),
      },
      {
        timestamp: formData.periodStart,
        kWh: parseFloat(formData.normalKwh) || 0,
        slotName: 'Normal',
        slotType: 'normal' as const,
        ratePaisa: getSlotRate(selectedTariff, 'normal'),
      },
      {
        timestamp: formData.periodStart,
        kWh: parseFloat(formData.offPeakKwh) || 0,
        slotName: 'Off-Peak',
        slotType: 'off-peak' as const,
        ratePaisa: getSlotRate(selectedTariff, 'off-peak'),
      },
    ].filter((r) => r.kWh > 0);

    const data = {
      readings,
      tariff: toTariffConfig(selectedTariff),
      contractedDemandKVA: parseFloat(formData.contractedDemandKva) || 0,
      recordedDemandKVA: parseFloat(formData.recordedDemandKva) || 0,
      powerFactor: parseFloat(formData.powerFactor) || 0.95,
    };

    try {
      const res = await calculateBill.mutateAsync(data);
      setResult(res);
    } catch {
      // error handled by toast
    }
  }

  async function handleSave() {
    if (!result || !selectedMeter || !selectedTariff) return;
    const vals = getValues();

    const id = crypto.randomUUID();
    const billData = {
      id,
      tenantId: selectedMeter.tenantId,
      meterId: selectedMeter.id,
      tariffId: selectedTariff.id,
      billingPeriodStart: vals.periodStart,
      billingPeriodEnd: vals.periodEnd,
      peakKwh: (result as Record<string, number>).peakKWh ?? 0,
      normalKwh: (result as Record<string, number>).normalKWh ?? 0,
      offPeakKwh: (result as Record<string, number>).offPeakKWh ?? 0,
      totalKwh: (result as Record<string, number>).totalKWh ?? 0,
      billedKvah: (result as Record<string, number | null>).billedKVAh ?? null,
      contractedDemandKva: parseFloat(vals.contractedDemandKva) || 0,
      recordedDemandKva: parseFloat(vals.recordedDemandKva) || 0,
      billedDemandKva: (result as Record<string, number>).billedDemandKVA ?? 0,
      powerFactor: parseFloat(vals.powerFactor) || 0.95,
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
      // error handled by toast
    }
  }

  return (
    <div className="bg-white rounded-lg border p-4 mb-4 space-y-4 dark:bg-gray-800 dark:border-gray-700">
      <form onSubmit={handleSubmit(onCalculate)} className="space-y-3" onChange={() => setResult(null)}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meter</label>
            <select
              {...register('meterId')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              <option value="">Select meter...</option>
              {meters?.map((m: Meter) => (
                <option key={m.id} value={m.id}>{m.name} ({m.stateCode})</option>
              ))}
            </select>
            {errors.meterId && <p className="mt-1 text-sm text-red-500">{errors.meterId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period Start</label>
            <input
              type="date"
              {...register('periodStart')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
            {errors.periodStart && <p className="mt-1 text-sm text-red-500">{errors.periodStart.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period End</label>
            <input
              type="date"
              {...register('periodEnd')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
            {errors.periodEnd && <p className="mt-1 text-sm text-red-500">{errors.periodEnd.message}</p>}
          </div>
        </div>

        {selectedTariff && (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            Tariff: {selectedTariff.stateCode} — {selectedTariff.discom} — {selectedTariff.category}
            {' '}(Base rate: {formatPaisa(selectedTariff.baseEnergyRatePaisa)}/kWh)
          </div>
        )}

        {meterId && periodStart && periodEnd && readings !== undefined && (
          <div className={`rounded-lg px-3 py-2 text-xs ${readings.length > 0 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
            {readings.length > 0
              ? `Auto-filled from ${readings.length} readings`
              : 'No readings found for this period — enter kWh manually'}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Peak kWh</label>
            <input type="number" step="0.01" {...register('peakKwh')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Normal kWh</label>
            <input type="number" step="0.01" {...register('normalKwh')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Off-Peak kWh</label>
            <input type="number" step="0.01" {...register('offPeakKwh')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contracted Demand (KVA)</label>
            <input type="number" step="0.01" {...register('contractedDemandKva')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recorded Demand (KVA)</label>
            <input type="number" step="0.01" {...register('recordedDemandKva')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Power Factor</label>
            <input type="number" step="0.01" min="0" max="1" {...register('powerFactor')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
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

        {!selectedTariff && meterId && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No tariff configured for this meter. Assign a tariff first.
          </p>
        )}
      </form>

      {result && (
        <BillPreview
          result={result}
          onSave={handleSave}
          saving={saveBill.isPending}
        />
      )}
    </div>
  );
}

function BillPreview({
  result,
  onSave,
  saving,
}: {
  result: Record<string, unknown>;
  onSave: () => void;
  saving: boolean;
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
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Bill Preview</h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total kWh</span>
          <p className="font-semibold dark:text-gray-100">{(r.totalKWh ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">Effective Rate</span>
          <p className="font-semibold dark:text-gray-100">{formatPaisa(r.effectiveRatePaisaPerKWh ?? 0)}/kWh</p>
        </div>
        <div className="rounded-lg bg-burgundy/10 p-3 dark:bg-burgundy-dark/20">
          <span className="text-xs text-burgundy">Total Bill</span>
          <p className="font-bold text-burgundy">{formatPaisa(r.totalBillPaisa ?? 0)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden mb-3 dark:bg-gray-800 dark:border-gray-700">
        <table className="w-full text-sm">
          <tbody>
            {lineItems.map(([label, paisa], i) => (
              <tr key={i} className={`border-b border-gray-100 dark:border-gray-700 ${label === 'Subtotal' ? 'font-semibold bg-gray-50 dark:bg-gray-700' : ''}`}>
                <td className="px-4 py-1.5 text-gray-600 dark:text-gray-400">{label as string}</td>
                <td className="px-4 py-1.5 text-right">{formatPaisa(paisa as number)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50 dark:bg-gray-700">
              <td className="px-4 py-2 dark:text-gray-200">Total</td>
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
    </div>
  );
}
