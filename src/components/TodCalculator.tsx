import { useState, useMemo } from 'react';
import { stateTariffs, exampleScenarios, calculateBill, type BillBreakdown, type StateTariff, type ExampleScenario } from '../data/tariffs';

// Format currency in Indian format (lakhs, crores)
function formatINR(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  } else {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  }
}

// Format number with Indian locale
function formatNumber(num: number): string {
  return num.toLocaleString('en-IN');
}

interface CalculatorInputs {
  state: string;
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

export default function TodCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    state: 'Maharashtra',
    monthlyConsumption: 100000,
    contractedDemand: 250,
    recordedDemand: 240,
    powerFactor: 0.95,
    pue: 1.6,
    dgConsumption: 2000,
    peakPercent: 35,
    normalPercent: 40,
    offPeakPercent: 25
  });

  const [showExamples, setShowExamples] = useState(false);

  // Get selected tariff
  const selectedTariff = useMemo(() => {
    return stateTariffs.find(t => t.state === inputs.state) || stateTariffs[0];
  }, [inputs.state]);

  // Calculate bill
  const billBreakdown = useMemo((): BillBreakdown => {
    // Apply PUE to get actual consumption
    const actualConsumption = inputs.monthlyConsumption * inputs.pue;

    return calculateBill(
      selectedTariff,
      actualConsumption,
      inputs.peakPercent,
      inputs.normalPercent,
      inputs.offPeakPercent,
      inputs.contractedDemand,
      inputs.recordedDemand,
      inputs.powerFactor,
      inputs.dgConsumption
    );
  }, [inputs, selectedTariff]);

  // Handle input changes
  const handleChange = (field: keyof CalculatorInputs, value: string | number) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  // Handle consumption pattern changes (ensure they sum to 100)
  const handlePatternChange = (field: 'peakPercent' | 'normalPercent' | 'offPeakPercent', value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    const otherFields = ['peakPercent', 'normalPercent', 'offPeakPercent'].filter(f => f !== field) as ('peakPercent' | 'normalPercent' | 'offPeakPercent')[];
    const remaining = 100 - clampedValue;
    const currentOtherSum = inputs[otherFields[0]] + inputs[otherFields[1]];

    if (currentOtherSum === 0) {
      setInputs(prev => ({
        ...prev,
        [field]: clampedValue,
        [otherFields[0]]: remaining / 2,
        [otherFields[1]]: remaining / 2
      }));
    } else {
      const ratio0 = inputs[otherFields[0]] / currentOtherSum;
      const ratio1 = inputs[otherFields[1]] / currentOtherSum;
      setInputs(prev => ({
        ...prev,
        [field]: clampedValue,
        [otherFields[0]]: Math.round(remaining * ratio0),
        [otherFields[1]]: Math.round(remaining * ratio1)
      }));
    }
  };

  // Load example scenario
  const loadExample = (scenario: ExampleScenario) => {
    setInputs({
      state: scenario.state,
      monthlyConsumption: scenario.monthlyConsumption,
      contractedDemand: scenario.contractedDemand,
      recordedDemand: scenario.recordedDemand,
      powerFactor: scenario.powerFactor,
      pue: scenario.pue,
      dgConsumption: scenario.dgConsumption,
      peakPercent: scenario.consumptionPattern.peakPercent,
      normalPercent: scenario.consumptionPattern.normalPercent,
      offPeakPercent: scenario.consumptionPattern.offPeakPercent
    });
    setShowExamples(false);
  };

  return (
    <div className="space-y-8">
      {/* Example Scenarios Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Configure Your Facility</h3>
        <button
          onClick={() => setShowExamples(!showExamples)}
          className="text-sm text-[--color-accent] hover:text-[--color-accent-dark] font-medium"
        >
          {showExamples ? 'Hide Examples' : 'Load Example Scenario'}
        </button>
      </div>

      {/* Example Scenarios */}
      {showExamples && (
        <div className="grid md:grid-cols-2 gap-4">
          {exampleScenarios.map((scenario, index) => (
            <button
              key={index}
              onClick={() => loadExample(scenario)}
              className="text-left p-4 rounded-lg border border-gray-200 hover:border-[--color-primary] hover:bg-gray-50 transition-all"
            >
              <h4 className="font-semibold text-gray-900 mb-1">{scenario.name}</h4>
              <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>{formatNumber(scenario.monthlyConsumption)} kWh/month</span>
                <span>PUE: {scenario.pue}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          {/* State Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
            <select
              value={inputs.state}
              onChange={(e) => handleChange('state', e.target.value)}
              className="calculator-select"
            >
              {stateTariffs.map(tariff => (
                <option key={tariff.stateCode} value={tariff.state}>
                  {tariff.state} ({tariff.discom})
                </option>
              ))}
            </select>
            {/* Billing unit & regulatory status indicator */}
            <div className="mt-2 flex items-center gap-3">
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                {selectedTariff.billingUnit} billing
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                selectedTariff.regulatoryStatus.startsWith('Litigation') || selectedTariff.regulatoryStatus.startsWith('Amendment')
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-green-50 text-green-700'
              }`}>
                {selectedTariff.regulatoryStatus.split(' - ')[0]}
              </span>
            </div>
          </div>

          {/* Monthly Consumption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              IT Load Consumption (kWh/month)
            </label>
            <input
              type="number"
              value={inputs.monthlyConsumption}
              onChange={(e) => handleChange('monthlyConsumption', parseFloat(e.target.value) || 0)}
              className="calculator-input"
              min="0"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-1">
              After PUE ({inputs.pue}): {formatNumber(Math.round(inputs.monthlyConsumption * inputs.pue))} kWh
              {selectedTariff.billingUnit === 'kVAh' && (
                <> | Billed: {formatNumber(Math.round(inputs.monthlyConsumption * inputs.pue / inputs.powerFactor))} kVAh (at PF {inputs.powerFactor})</>
              )}
            </p>
          </div>

          {/* PUE */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Power Usage Effectiveness (PUE)
            </label>
            <input
              type="number"
              value={inputs.pue}
              onChange={(e) => handleChange('pue', parseFloat(e.target.value) || 1)}
              className="calculator-input"
              min="1"
              max="3"
              step="0.05"
            />
          </div>

          {/* Demand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contracted Demand (kVA)
              </label>
              <input
                type="number"
                value={inputs.contractedDemand}
                onChange={(e) => handleChange('contractedDemand', parseFloat(e.target.value) || 0)}
                className="calculator-input"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recorded Demand (kVA)
              </label>
              <input
                type="number"
                value={inputs.recordedDemand}
                onChange={(e) => handleChange('recordedDemand', parseFloat(e.target.value) || 0)}
                className="calculator-input"
                min="0"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-4">
            {selectedTariff.demandBillingRule}
          </p>

          {/* Power Factor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Power Factor
            </label>
            <input
              type="number"
              value={inputs.powerFactor}
              onChange={(e) => handleChange('powerFactor', parseFloat(e.target.value) || 0)}
              className="calculator-input"
              min="0.5"
              max="1"
              step="0.01"
            />
            {inputs.powerFactor < selectedTariff.powerFactorPenaltyThreshold && (
              <p className="text-xs text-[--color-accent] mt-1">
                Below {selectedTariff.powerFactorPenaltyThreshold} threshold - penalty applies
              </p>
            )}
            {selectedTariff.billingUnit === 'kVAh' && inputs.powerFactor < 1 && (
              <p className="text-xs text-amber-600 mt-1">
                kVAh billing: PF of {inputs.powerFactor} increases billed units by {((1/inputs.powerFactor - 1) * 100).toFixed(1)}%
              </p>
            )}
          </div>

          {/* DG Consumption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              DG Consumption (kWh/month)
            </label>
            <input
              type="number"
              value={inputs.dgConsumption}
              onChange={(e) => handleChange('dgConsumption', parseFloat(e.target.value) || 0)}
              className="calculator-input"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              DG Rate: ₹{selectedTariff.dgRate}/kWh
            </p>
          </div>

          {/* Consumption Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Consumption Pattern (% by ToD slot)
            </label>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[--color-accent]">Peak Hours</span>
                  <span>{inputs.peakPercent}%</span>
                </div>
                <input
                  type="range"
                  value={inputs.peakPercent}
                  onChange={(e) => handlePatternChange('peakPercent', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[--color-accent]"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Normal Hours</span>
                  <span>{inputs.normalPercent}%</span>
                </div>
                <input
                  type="range"
                  value={inputs.normalPercent}
                  onChange={(e) => handlePatternChange('normalPercent', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-500"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[--color-primary]">Off-Peak Hours</span>
                  <span>{inputs.offPeakPercent}%</span>
                </div>
                <input
                  type="range"
                  value={inputs.offPeakPercent}
                  onChange={(e) => handlePatternChange('offPeakPercent', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[--color-primary]"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Total Bill Card */}
          <div className="result-card">
            <div className="label">Estimated Monthly Bill</div>
            <div className="value">{formatINR(billBreakdown.totalBill)}</div>
            <div className="text-sm text-white/70 mt-2">
              Effective Rate: ₹{billBreakdown.effectiveRate.toFixed(2)}/kWh
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">Bill Breakdown</h4>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Energy Charges */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">
                    Energy Charges
                    <span className="text-xs text-gray-500 ml-1">({selectedTariff.billingUnit})</span>
                  </span>
                  <span className="font-semibold">{formatINR(billBreakdown.energyCharges.total)}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-[--color-accent]">
                    <span>Peak ({inputs.peakPercent}%)</span>
                    <span>{formatINR(billBreakdown.energyCharges.peak)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Normal ({inputs.normalPercent}%)</span>
                    <span>{formatINR(billBreakdown.energyCharges.normal)}</span>
                  </div>
                  <div className="flex justify-between text-[--color-primary]">
                    <span>Off-Peak ({inputs.offPeakPercent}%)</span>
                    <span>{formatINR(billBreakdown.energyCharges.offPeak)}</span>
                  </div>
                </div>
              </div>

              {/* Wheeling Charges */}
              {billBreakdown.wheelingCharges > 0 && (
                <div className="p-4 flex justify-between">
                  <span className="text-gray-700">Wheeling Charges (₹{selectedTariff.wheelingCharge}/{selectedTariff.billingUnit})</span>
                  <span className="font-medium">{formatINR(billBreakdown.wheelingCharges)}</span>
                </div>
              )}

              {/* Demand Charges */}
              <div className="p-4 flex justify-between">
                <span className="text-gray-700">Demand Charges ({Math.max(inputs.contractedDemand, inputs.recordedDemand)} kVA × ₹{selectedTariff.demandCharge})</span>
                <span className="font-medium">{formatINR(billBreakdown.demandCharges)}</span>
              </div>

              {/* FAC */}
              <div className="p-4 flex justify-between">
                <span className="text-gray-700">
                  {selectedTariff.fuelAdjustmentType === 'percentage'
                    ? `FPPCA (${selectedTariff.fuelAdjustmentCharge}% of energy)`
                    : `Fuel Adjustment (₹${selectedTariff.fuelAdjustmentCharge}/${selectedTariff.billingUnit})`
                  }
                </span>
                <span className="font-medium">{formatINR(billBreakdown.fuelAdjustment)}</span>
              </div>

              {/* DG Charges */}
              {billBreakdown.dgCharges > 0 && (
                <div className="p-4 flex justify-between">
                  <span className="text-gray-700">DG Power Charges</span>
                  <span className="font-medium">{formatINR(billBreakdown.dgCharges)}</span>
                </div>
              )}

              {/* PF Penalty */}
              {billBreakdown.powerFactorPenalty > 0 && (
                <div className="p-4 flex justify-between text-[--color-accent]">
                  <span>Power Factor Penalty</span>
                  <span className="font-medium">{formatINR(billBreakdown.powerFactorPenalty)}</span>
                </div>
              )}

              {/* Electricity Duty */}
              <div className="p-4 flex justify-between">
                <span className="text-gray-700">Electricity Duty ({(selectedTariff.electricityDuty * 100).toFixed(0)}%)</span>
                <span className="font-medium">{formatINR(billBreakdown.electricityDuty)}</span>
              </div>

              {/* Subtotal */}
              <div className="p-4 flex justify-between bg-gray-50">
                <span className="font-medium text-gray-900">Subtotal</span>
                <span className="font-semibold">{formatINR(billBreakdown.subtotal)}</span>
              </div>

              {/* GST */}
              <div className="p-4 flex justify-between">
                <span className="text-gray-700">GST (18%)</span>
                <span className="font-medium">{formatINR(billBreakdown.gst)}</span>
              </div>

              {/* Total */}
              <div className="p-4 flex justify-between bg-[--color-primary] text-white">
                <span className="font-semibold">Total Bill</span>
                <span className="font-bold text-lg">{formatINR(billBreakdown.totalBill)}</span>
              </div>
            </div>
          </div>

          {/* State Tariff Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 mb-3">{selectedTariff.state} Tariff Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Energy Rate</span>
                <span>₹{selectedTariff.baseEnergyRate}/{selectedTariff.billingUnit}</span>
              </div>
              {selectedTariff.wheelingCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Wheeling Charge</span>
                  <span>₹{selectedTariff.wheelingCharge}/{selectedTariff.billingUnit}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Demand Charge</span>
                <span>₹{selectedTariff.demandCharge}/kVA/month</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Category</span>
                <span className="text-right text-xs">{selectedTariff.category}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">{selectedTariff.notes}</p>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-xs text-amber-600">{selectedTariff.regulatoryStatus}</p>
              </div>
            </div>
          </div>

          {/* Time Slots */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h4 className="font-semibold text-gray-900">ToD Time Slots</h4>
            </div>
            <div>
              {selectedTariff.timeSlots.map((slot, index) => (
                <div
                  key={index}
                  className={`time-slot ${slot.type === 'peak' ? 'peak' : slot.type === 'off-peak' ? 'off-peak' : ''}`}
                >
                  <div>
                    <span className="font-medium">{slot.name}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {slot.startHour.toString().padStart(2, '0')}:00 - {slot.endHour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                  <div className="text-right">
                    {slot.multiplier !== 1 && (
                      <span className={slot.multiplier > 1 ? 'text-[--color-accent]' : 'text-[--color-primary]'}>
                        {slot.multiplier > 1 ? '+' : ''}{((slot.multiplier - 1) * 100).toFixed(0)}%
                      </span>
                    )}
                    {slot.adder !== 0 && (
                      <span className={slot.adder > 0 ? 'text-[--color-accent]' : 'text-[--color-primary]'}>
                        {slot.adder > 0 ? '+' : ''}₹{slot.adder.toFixed(2)}/unit
                      </span>
                    )}
                    {slot.multiplier === 1 && slot.adder === 0 && (
                      <span className="text-gray-500">Base Rate</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Attribution */}
          <div className="text-xs text-gray-400 text-center">
            Sources: MERC Case 75/2025, TNERC Order 6/2025, KERC MYT 2025, TSERC RST 2025-26
          </div>
        </div>
      </div>
    </div>
  );
}
