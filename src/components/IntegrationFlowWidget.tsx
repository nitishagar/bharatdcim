import { useEffect, useMemo, useState } from 'react';
import { calculateBill, stateTariffs, getEffectiveRate, type StateTariff, type TimeSlot } from '../data/tariffs';

type DcimSource = 'nlyte' | 'sunbird' | 'schneider' | 'custom';

interface MeterReading {
  rack: string;
  kWh: number;
  hour: number;
  source: 'grid' | 'dg';
}

const dcimSources: Record<DcimSource, { name: string; protocol: string; icon: string }> = {
  nlyte: { name: 'Nlyte Software', protocol: 'REST API v2', icon: 'N' },
  sunbird: { name: 'Sunbird dcTrack', protocol: 'REST API', icon: 'S' },
  schneider: { name: 'EcoStruxure IT', protocol: 'SNMP v3', icon: 'E' },
  custom: { name: 'Custom DCIM', protocol: 'CSV / Modbus', icon: 'C' }
};

const rackNames = ['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'B-03', 'C-01', 'C-02'];

function slotContainsHour(slot: TimeSlot, hour: number): boolean {
  if (slot.startHour < slot.endHour) return hour >= slot.startHour && hour < slot.endHour;
  return hour >= slot.startHour || hour < slot.endHour;
}

function getSlotForHour(tariff: StateTariff, hour: number): TimeSlot | undefined {
  return tariff.timeSlots.find((slot) => slotContainsHour(slot, hour));
}

function formatINR(amount: number): string {
  if (amount >= 10000000) return `Rs.${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `Rs.${(amount / 100000).toFixed(1)} L`;
  return `Rs.${Math.round(amount).toLocaleString('en-IN')}`;
}

function generateReading(hour: number): MeterReading {
  const rack = rackNames[Math.floor(Math.random() * rackNames.length)];
  const base = 40 + Math.random() * 60;
  const isDG = Math.random() < 0.08;
  return { rack, kWh: Math.round(base * 10) / 10, hour, source: isDG ? 'dg' : 'grid' };
}

export default function IntegrationFlowWidget() {
  const [selectedDcim, setSelectedDcim] = useState<DcimSource>('nlyte');
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [simHour, setSimHour] = useState(18);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [processStep, setProcessStep] = useState(-1); // -1=idle, 0-3=animating steps, 4=complete

  // Trigger animation on mount and whenever user changes an input
  useEffect(() => {

    // Reset pipeline and start animation
    setProcessStep(0);
    const initialReadings = Array.from({ length: 3 }, () => generateReading(simHour));
    setReadings(initialReadings);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= 3) {
        setProcessStep(step);
        setReadings(prev => [generateReading(simHour), ...prev].slice(0, 6));
      } else {
        setProcessStep(4); // all steps complete — reveal billing
        clearInterval(interval);
      }
    }, 900);

    return () => clearInterval(interval);
  }, [selectedDcim, selectedState, simHour]);

  const tariff = useMemo(
    () => stateTariffs.find(t => t.state === selectedState) ?? stateTariffs[0],
    [selectedState]
  );

  const currentSlot = useMemo(() => getSlotForHour(tariff, simHour), [tariff, simHour]);

  const effectiveRate = useMemo(
    () => currentSlot ? getEffectiveRate(tariff.baseEnergyRate, currentSlot) : tariff.baseEnergyRate,
    [tariff, currentSlot]
  );

  const bill = useMemo(() => {
    const profile = { consumption: 180000, demand: 400, recorded: 380, pf: 0.95, dg: 3200, peak: 34, normal: 41, offPeak: 25 };
    return calculateBill(tariff, profile.consumption, profile.peak, profile.normal, profile.offPeak, profile.demand, profile.recorded, profile.pf, profile.dg);
  }, [tariff]);

  const dcim = dcimSources[selectedDcim];
  const pipelineSteps = ['Ingest', 'Classify ToD', 'Apply Tariff', 'Generate Invoice'];
  const slotLabel = currentSlot?.type ?? 'normal';
  const slotColor = slotLabel === 'peak' ? '#8b2e3e' : slotLabel === 'off-peak' ? '#1e3a5f' : '#6b7280';

  return (
    <div className="relative surface-elevated overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 bg-gray-50/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Integration Pipeline</span>
          {processStep === -1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Idle</span>}
          {processStep >= 0 && processStep < 4 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium animate-pulse">Processing…</span>}
          {processStep === 4 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Complete</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${processStep >= 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
            {processStep >= 0 ? 'Connected' : 'Waiting'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid sm:grid-cols-3 gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">DCIM Source</label>
          <div className="relative">
            <select
              value={selectedDcim}
              onChange={e => setSelectedDcim(e.target.value as DcimSource)}
              className="w-full h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm font-medium text-gray-700"
            >
              {(Object.keys(dcimSources) as DcimSource[]).map(key => (
                <option key={key} value={key}>{dcimSources[key].name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">State Tariff</label>
          <div className="relative">
            <select
              value={selectedState}
              onChange={e => setSelectedState(e.target.value)}
              className="w-full h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm font-medium text-gray-700"
            >
              {stateTariffs.map(t => (
                <option key={t.stateCode} value={t.state}>{t.state} ({t.discom.split('/')[0].trim()})</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Simulate Hour</label>
          <div className="flex items-center gap-2">
            <input
              type="range" min={0} max={23} value={simHour}
              onChange={e => setSimHour(parseInt(e.target.value, 10))}
              className="flex-1 h-2 rounded-lg bg-gray-200 accent-[#8b2e3e] cursor-pointer"
            />
            <span className="text-sm font-mono font-semibold text-gray-700 w-12 text-right">{String(simHour).padStart(2, '0')}:00</span>
          </div>
        </div>
      </div>

      {/* Pipeline - 3 stages */}
      <div className="grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-0 items-stretch">

        {/* STAGE 1: DCIM Raw Feed */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-bold">{dcim.icon}</div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{dcim.name}</div>
              <div className="text-[10px] text-gray-500">{dcim.protocol}</div>
            </div>
          </div>
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Incoming Meter Data</div>
          {processStep === -1 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
              </div>
              <p className="text-xs text-gray-500">Change a DCIM source, state, or hour<br/>to start the simulation</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {readings.map((r, i) => (
                  <div
                    key={`${r.rack}-${i}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-mono transition-all"
                    style={{
                      background: i === 0 ? 'rgba(30, 58, 95, 0.08)' : 'transparent',
                      opacity: 1 - i * 0.12
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.source === 'dg' ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                    <span className="text-gray-600 w-8">{r.rack}</span>
                    <span className="text-gray-900 font-semibold">{r.kWh} kWh</span>
                    <span className="text-gray-400 ml-auto">{String(r.hour).padStart(2, '0')}:{String(Math.floor(Math.random() * 60)).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Grid</span>
                <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> DG</span>
              </div>
            </>
          )}
        </div>

        {/* Arrow 1 */}
        <div className="hidden lg:flex items-center justify-center px-2">
          <div className="flex flex-col items-center gap-1">
            <svg className="w-5 h-5 text-[#8b2e3e]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd"/></svg>
            <span className="text-[9px] text-gray-400 font-medium">SNMP</span>
          </div>
        </div>
        {/* Mobile arrow */}
        <div className="lg:hidden flex justify-center py-2 border-b border-gray-100">
          <svg className="w-5 h-5 text-[#8b2e3e] rotate-90" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd"/></svg>
        </div>

        {/* STAGE 2: BharatDCIM Processing */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-gray-100 bg-gradient-to-b from-[#8b2e3e]/[0.03] to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#8b2e3e] flex items-center justify-center text-white text-xs font-bold">B</div>
            <div>
              <div className="text-sm font-semibold text-gray-900">BharatDCIM Engine</div>
              <div className="text-[10px] text-gray-500">Real-time processing</div>
            </div>
          </div>

          {/* Processing pipeline steps */}
          <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">Processing Pipeline</div>
          <div className="space-y-2 mb-4">
            {pipelineSteps.map((step, i) => {
              const isComplete = processStep === 4 || (processStep >= 0 && i < processStep);
              const isActive = processStep >= 0 && processStep < 4 && i === processStep;
              const isPending = processStep === -1 || (processStep < 4 && i > processStep);
              return (
                <div key={step} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all ${
                    isComplete ? 'bg-green-500 text-white' :
                    isActive ? 'bg-[#8b2e3e] text-white scale-110' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {isComplete ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs ${isActive ? 'text-gray-900 font-semibold' : isComplete ? 'text-green-700' : 'text-gray-500'}`}>{step}</span>
                </div>
              );
            })}
          </div>

          {/* Current classification */}
          <div className="rounded-lg border border-gray-200 p-3 bg-white">
            <div className="text-[10px] text-gray-500 mb-1.5">Current Classification</div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: slotColor }}
              >
                {slotLabel.toUpperCase()}
              </span>
              <span className="text-xs text-gray-600">{currentSlot?.name ?? 'Normal'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-gray-500">Base rate</span>
                <div className="font-semibold text-gray-900">Rs.{tariff.baseEnergyRate.toFixed(2)}/{tariff.billingUnit}</div>
              </div>
              <div>
                <span className="text-gray-500">Effective rate</span>
                <div className="font-semibold" style={{ color: slotColor }}>Rs.{effectiveRate.toFixed(2)}/{tariff.billingUnit}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow 2 */}
        <div className="hidden lg:flex items-center justify-center px-2">
          <div className="flex flex-col items-center gap-1">
            <svg className="w-5 h-5 text-[#8b2e3e]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd"/></svg>
            <span className="text-[9px] text-gray-400 font-medium">GST</span>
          </div>
        </div>
        {/* Mobile arrow */}
        <div className="lg:hidden flex justify-center py-2 border-b border-gray-100">
          <svg className="w-5 h-5 text-[#8b2e3e] rotate-90" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd"/></svg>
        </div>

        {/* STAGE 3: Billing Output */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${processStep === 4 ? 'bg-green-600' : 'bg-gray-300'}`}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Billing Output</div>
              <div className="text-[10px] text-gray-500">{processStep === 4 ? 'GST-compliant invoice' : 'Waiting for pipeline'}</div>
            </div>
          </div>

          {processStep === 4 ? (
            <>
              {/* Invoice preview — revealed after Generate Invoice completes */}
              <div className="rounded-lg border border-gray-200 overflow-hidden mb-3 animate-[fadeIn_0.4s_ease-out]">
                <div className="bg-[#1e3a5f] px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-white/80 font-medium">Invoice Preview</span>
                  <span className="text-[9px] text-white/60">{tariff.state} ({tariff.stateCode})</span>
                </div>
                <div className="p-3 space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Energy charges</span>
                    <span className="font-semibold text-gray-900">{formatINR(bill.energyCharges.total)}</span>
                  </div>
                  <div className="flex justify-between pl-3 text-[10px]">
                    <span className="text-gray-400">Peak ({bill.energyCharges.peak > 0 ? Math.round(bill.energyCharges.peak / bill.energyCharges.total * 100) : 0}%)</span>
                    <span className="text-[#8b2e3e]">{formatINR(bill.energyCharges.peak)}</span>
                  </div>
                  <div className="flex justify-between pl-3 text-[10px]">
                    <span className="text-gray-400">Off-peak ({bill.energyCharges.offPeak > 0 ? Math.round(bill.energyCharges.offPeak / bill.energyCharges.total * 100) : 0}%)</span>
                    <span className="text-[#1e3a5f]">{formatINR(bill.energyCharges.offPeak)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Demand charges</span>
                    <span className="font-semibold text-gray-900">{formatINR(bill.demandCharges)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">DG charges</span>
                    <span className="font-semibold text-gray-900">{formatINR(bill.dgCharges)}</span>
                  </div>
                  <div className="border-t border-gray-100 pt-1.5 flex justify-between">
                    <span className="text-gray-500">GST (18%)</span>
                    <span className="text-gray-700">{formatINR(bill.gst)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-1.5 flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-gray-900">{formatINR(bill.totalBill)}</span>
                  </div>
                </div>
              </div>

              {/* Output metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-gray-200 p-2.5">
                  <div className="text-[10px] text-gray-500">Effective Rate</div>
                  <div className="text-sm font-bold text-gray-900">Rs.{bill.effectiveRate.toFixed(2)}/kWh</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-2.5">
                  <div className="text-[10px] text-gray-500">SAC Code</div>
                  <div className="text-sm font-bold text-gray-900">998315</div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
              </div>
              {processStep >= 0 && processStep < 4 ? (
                <p className="text-xs text-gray-400">Processing pipeline…<br/>Invoice will appear after completion</p>
              ) : (
                <p className="text-xs text-gray-400">Invoice will be generated<br/>after the pipeline runs</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span className="font-medium">Protocols:</span>
          <span className="badge-chip !py-0.5 !px-2 !text-[10px]">REST API</span>
          <span className="badge-chip !py-0.5 !px-2 !text-[10px]">SNMP v2/v3</span>
          <span className="badge-chip !py-0.5 !px-2 !text-[10px]">Modbus TCP</span>
          <span className="badge-chip !py-0.5 !px-2 !text-[10px]">CSV</span>
        </div>
        <div className="text-[10px] text-gray-400">Simulated data for demonstration</div>
      </div>
    </div>
  );
}
