import { useMemo, useState } from 'react';
import { calculateBill, stateTariffs, type StateTariff, type TimeSlot } from '../data/tariffs';

type ViewMode = 'consumption' | 'cost';

interface Profile {
  monthlyConsumption: number;
  contractedDemand: number;
  recordedDemand: number;
  powerFactor: number;
  pue: number;
  dgConsumption: number;
  peakPercent: number;
  normalPercent: number;
  offPeakPercent: number;
}

const tenantNames = ['CloudServe', 'DataFlow Inc', 'NetPrime'];
const tenantWeights = [0.42, 0.33, 0.25];

const stateProfiles: Record<string, Profile> = {
  Maharashtra: {
    monthlyConsumption: 180000,
    contractedDemand: 400,
    recordedDemand: 380,
    powerFactor: 0.95,
    pue: 1.62,
    dgConsumption: 3200,
    peakPercent: 34,
    normalPercent: 41,
    offPeakPercent: 25
  },
  'Tamil Nadu': {
    monthlyConsumption: 220000,
    contractedDemand: 520,
    recordedDemand: 500,
    powerFactor: 0.94,
    pue: 1.58,
    dgConsumption: 2800,
    peakPercent: 36,
    normalPercent: 44,
    offPeakPercent: 20
  },
  Karnataka: {
    monthlyConsumption: 190000,
    contractedDemand: 430,
    recordedDemand: 410,
    powerFactor: 0.96,
    pue: 1.55,
    dgConsumption: 2200,
    peakPercent: 28,
    normalPercent: 47,
    offPeakPercent: 25
  },
  Telangana: {
    monthlyConsumption: 240000,
    contractedDemand: 560,
    recordedDemand: 535,
    powerFactor: 0.97,
    pue: 1.57,
    dgConsumption: 2600,
    peakPercent: 33,
    normalPercent: 50,
    offPeakPercent: 17
  }
};

const hourlyTemplate = [46, 40, 37, 35, 38, 45, 53, 61, 72, 84, 78, 65];
const hourLabels = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'];

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

function formatINRCompact(amount: number): string {
  if (amount >= 10000000) return `Rs.${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `Rs.${(amount / 100000).toFixed(1)}L`;
  return `Rs.${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatUnit(value: number): string {
  return `${Math.round(value).toLocaleString('en-IN')} kWh`;
}

function slotContainsHour(slot: TimeSlot, hour: number): boolean {
  if (slot.startHour < slot.endHour) return hour >= slot.startHour && hour < slot.endHour;
  return hour >= slot.startHour || hour < slot.endHour;
}

function getSlotForHour(tariff: StateTariff, hour: number): TimeSlot | undefined {
  return tariff.timeSlots.find((slot) => slotContainsHour(slot, hour));
}

export default function HeroDashboardWidget() {
  const [selectedState, setSelectedState] = useState('Karnataka');
  const [viewMode, setViewMode] = useState<ViewMode>('consumption');
  const [peakBias, setPeakBias] = useState(0);

  const model = useMemo(() => {
    const tariff = stateTariffs.find((item) => item.state === selectedState) ?? stateTariffs[0];
    const profile = stateProfiles[selectedState] ?? stateProfiles.Karnataka;

    const rawPeak = clamp(profile.peakPercent + peakBias, 12, 70);
    const rawOffPeak = clamp(profile.offPeakPercent - Math.round(peakBias * 0.6), 8, 45);
    const rawNormal = Math.max(5, 100 - rawPeak - rawOffPeak);
    const total = rawPeak + rawNormal + rawOffPeak;
    const peakPercent = Math.round((rawPeak / total) * 100);
    const normalPercent = Math.round((rawNormal / total) * 100);
    const offPeakPercent = 100 - peakPercent - normalPercent;

    const totalConsumption = profile.monthlyConsumption * profile.pue;
    const bill = calculateBill(
      tariff,
      totalConsumption,
      peakPercent,
      normalPercent,
      offPeakPercent,
      profile.contractedDemand,
      profile.recordedDemand,
      profile.powerFactor,
      profile.dgConsumption
    );

    const bars = hourlyTemplate.map((base, index) => {
      const hour = index * 2;
      const slot = getSlotForHour(tariff, hour);
      const slotType = slot?.type ?? 'normal';
      const rateFactor = slot ? Math.max(0.3, slot.multiplier + slot.adder / Math.max(1, tariff.baseEnergyRate)) : 1;
      const biasFactor = slotType === 'peak' ? 1 + peakBias / 75 : slotType === 'off-peak' ? 1 - peakBias / 120 : 1;
      const consumption = Math.max(18, base * biasFactor);
      const plottedValue = viewMode === 'consumption' ? consumption : consumption * rateFactor;
      return { plottedValue, slotType };
    });

    const maxBar = Math.max(...bars.map((bar) => bar.plottedValue), 1);
    const chart = bars.map((bar) => ({
      ...bar,
      heightPercent: Math.max(12, Math.round((bar.plottedValue / maxBar) * 100))
    }));

    const tenants = tenantNames.map((name, index) => {
      const consumption = totalConsumption * tenantWeights[index];
      const amount = bill.totalBill * tenantWeights[index];
      return {
        name,
        consumption: formatUnit(consumption),
        rate: `Rs.${bill.effectiveRate.toFixed(2)}/kWh`,
        amount: formatINRCompact(amount)
      };
    });

    return { tariff, bill, chart, tenants, peakPercent, normalPercent, offPeakPercent };
  }, [selectedState, viewMode, peakBias]);

  return (
    <div className="relative surface-elevated p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-sm font-semibold text-gray-500">app.bharatdcim.com</div>
        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Live meter stream</span>
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 mb-4">
        <div className="relative">
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full h-11 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm font-medium text-gray-700 leading-tight"
            aria-label="Select state tariff profile"
          >
            {stateTariffs.map((tariff) => (
              <option key={tariff.stateCode} value={tariff.state}>
                {tariff.state} ({tariff.stateCode})
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            type="button"
            onClick={() => setViewMode('consumption')}
            className={`px-3 py-1.5 text-xs rounded ${viewMode === 'consumption' ? 'bg-[#1e3a5f] text-white' : 'text-gray-600'}`}
          >
            Consumption
          </button>
          <button
            type="button"
            onClick={() => setViewMode('cost')}
            className={`px-3 py-1.5 text-xs rounded ${viewMode === 'cost' ? 'bg-[#8b2e3e] text-white' : 'text-gray-600'}`}
          >
            Cost Impact
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Peak load bias</span>
          <span>{peakBias > 0 ? `+${peakBias}` : peakBias}%</span>
        </div>
        <input
          type="range"
          min={-20}
          max={20}
          value={peakBias}
          onChange={(e) => setPeakBias(parseInt(e.target.value, 10))}
          className="w-full h-2 rounded-lg bg-gray-200 accent-[#8b2e3e] cursor-pointer"
          aria-label="Adjust peak load bias"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-[#1e3a5f] bg-[#1e3a5f] p-3 text-white shadow-sm">
          <div className="text-[11px] text-white/70">Monthly Bill</div>
          <div className="text-lg font-bold">{formatINRCompact(model.bill.totalBill)}</div>
          <div className="text-[10px] text-green-200">Realtime estimate</div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] text-gray-500">Effective Rate</div>
          <div className="text-lg font-bold text-gray-900">Rs.{model.bill.effectiveRate.toFixed(2)}</div>
          <div className="text-[10px] text-gray-500">/kWh</div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] text-gray-500">ToD Mix</div>
          <div className="text-xs font-semibold text-gray-900">
            P {model.peakPercent}% | N {model.normalPercent}% | O {model.offPeakPercent}%
          </div>
          <div className="text-[10px] text-green-600">{model.tariff.stateCode} profile</div>
        </div>
      </div>

      <div className="metric-card mb-4">
        <div className="text-xs text-gray-500 mb-3">
          {viewMode === 'consumption' ? 'ToD Consumption Pattern' : 'ToD Cost Intensity'} - {model.tariff.state} ({model.tariff.discom.split('/')[0].trim()})
        </div>
        <div className="flex items-end gap-1 h-24 mb-1">
          {model.chart.map((bar, index) => (
            <div
              key={hourLabels[index]}
              className="flex-1 rounded-t transition-all"
              style={{
                height: `${bar.heightPercent}%`,
                background:
                  bar.slotType === 'peak'
                    ? 'rgba(139, 46, 62, 0.8)'
                    : bar.slotType === 'off-peak'
                      ? 'rgba(30, 58, 95, 0.35)'
                      : 'rgba(30, 58, 95, 0.6)'
              }}
            />
          ))}
        </div>
        <div className="text-[10px] text-gray-400 grid grid-cols-6 gap-1">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 text-[10px] font-medium text-gray-500 grid grid-cols-4">
          <span>Tenant</span>
          <span>Consumption</span>
          <span>Rate</span>
          <span>Amount</span>
        </div>
        {model.tenants.map((tenant) => (
          <div key={tenant.name} className="px-3 py-2 text-[10px] text-gray-700 grid grid-cols-4 border-t border-gray-100">
            <span>{tenant.name}</span>
            <span>{tenant.consumption}</span>
            <span>{tenant.rate}</span>
            <span className="font-medium">{tenant.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
