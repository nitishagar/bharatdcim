// Indian State-wise Data Center Power Tariff Data
// Source: State Electricity Regulatory Commissions (MERC, TNERC, KERC, TSERC)
// Verified: February 2026 from official tariff orders
// MERC Case 75/2025, TNERC Order 6/2025, KERC Tariff Order 2025, TSERC RST Order 2025-26

export interface TimeSlot {
  name: string;
  startHour: number;
  endHour: number;
  type: 'peak' | 'normal' | 'off-peak';
  multiplier: number; // For percentage-based (e.g., 1.25 = +25%)
  adder: number; // For absolute adders (e.g., 1.00 = +₹1/unit)
}

export interface StateTariff {
  state: string;
  stateCode: string;
  discom: string;
  category: string;
  billingUnit: 'kWh' | 'kVAh';
  baseEnergyRate: number; // ₹/kWh or ₹/kVAh
  wheelingCharge: number; // ₹/unit
  demandCharge: number; // ₹/kVA/month
  demandBillingRule: string; // How billing demand is calculated
  timeSlots: TimeSlot[];
  fuelAdjustmentCharge: number; // ₹/unit (FAC/FPPCA)
  fuelAdjustmentType: 'absolute' | 'percentage'; // How FAC is applied
  electricityDuty: number; // Percentage
  powerFactorPenaltyThreshold: number; // Below this PF, penalty applies
  powerFactorPenaltyRate: number; // ₹/kVAh penalty
  dgRate: number; // Typical DG power rate ₹/kWh
  regulatoryStatus: string; // Current regulatory status
  notes: string;
}

export const stateTariffs: StateTariff[] = [
  {
    state: 'Maharashtra',
    stateCode: 'MH',
    discom: 'MSEDCL / MERC',
    category: 'HT I(A) Industry (General)',
    billingUnit: 'kVAh',
    baseEnergyRate: 7.45, // ₹/kVAh (MERC Case 75/2025)
    wheelingCharge: 0.80, // ₹/kVAh
    demandCharge: 750, // ₹/kVA/month
    demandBillingRule: 'Higher of: Actual MD, 75% of Contract Demand, or 50 kVA',
    timeSlots: [
      { name: 'Night Off-Peak', startHour: 22, endHour: 6, type: 'off-peak', multiplier: 1.0, adder: -1.50 },
      { name: 'Morning Normal', startHour: 6, endHour: 9, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Morning Peak', startHour: 9, endHour: 12, type: 'peak', multiplier: 1.0, adder: 0.80 },
      { name: 'Solar Hours', startHour: 12, endHour: 18, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Evening Peak', startHour: 18, endHour: 22, type: 'peak', multiplier: 1.0, adder: 1.10 },
    ],
    fuelAdjustmentCharge: 0.72, // ₹/kVAh mid-range estimate (range: 0.50-0.95)
    fuelAdjustmentType: 'absolute',
    electricityDuty: 0.16, // 16%
    powerFactorPenaltyThreshold: 0.90,
    powerFactorPenaltyRate: 0.25,
    dgRate: 22.0,
    regulatoryStatus: 'Litigation Active - MERC Case 75/2025 remanded by Bombay HC. Current rates operational but sub judice.',
    notes: 'kVAh billing (apparent energy). Night rebate -₹1.50 (22:00-06:00) is the most aggressive night incentive. Morning peak 09-12 (+₹0.80) and evening peak 18-22 (+₹1.10) reflect solar duck curve management. Total variable cost including wheeling: ₹8.25/kVAh.'
  },
  {
    state: 'Tamil Nadu',
    stateCode: 'TN',
    discom: 'TANGEDCO / TNERC',
    category: 'HT Tariff I – Industries',
    billingUnit: 'kWh',
    baseEnergyRate: 7.50, // ₹/kWh (TNERC Order 6/2025)
    wheelingCharge: 1.04, // ₹/kWh (for open access consumers)
    demandCharge: 608, // ₹/kVA/month
    demandBillingRule: 'Higher of: Actual MD or 90% of Contract Demand (strictest ratchet in India)',
    timeSlots: [
      { name: 'Night Off-Peak', startHour: 22, endHour: 5, type: 'off-peak', multiplier: 0.95, adder: 0 }, // -5% rebate
      { name: 'Early Morning', startHour: 5, endHour: 6, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Morning Peak', startHour: 6, endHour: 10, type: 'peak', multiplier: 1.25, adder: 0 }, // +25% surcharge
      { name: 'Normal', startHour: 10, endHour: 18, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Evening Peak', startHour: 18, endHour: 22, type: 'peak', multiplier: 1.25, adder: 0 }, // +25% surcharge
    ],
    fuelAdjustmentCharge: 1.58, // 1.58% of energy charges (FPPCA)
    fuelAdjustmentType: 'percentage',
    electricityDuty: 0.05, // 5%
    powerFactorPenaltyThreshold: 0.90,
    powerFactorPenaltyRate: 0.20,
    dgRate: 24.0,
    regulatoryStatus: 'Definitive - TNERC Order 6 of 2025, effective 1 July 2025. CPI-linked annual revision capped at 6%.',
    notes: 'Dual peak windows (06:00-10:00 and 18:00-22:00) with punitive +25% surcharge. Night hours (22:00-05:00) earn only 5% rebate. 90% demand ratchet is strictest in India. Harmonic distortion penalty: 15% of monthly bill for IEEE 519 non-compliance.'
  },
  {
    state: 'Karnataka',
    stateCode: 'KA',
    discom: 'BESCOM / KERC',
    category: 'HT-2(a) Industries',
    billingUnit: 'kWh',
    baseEnergyRate: 6.60, // ₹/kWh (KERC Tariff Order 2025) - flat rate, slab system abolished
    wheelingCharge: 0, // Included in base for grid consumers
    demandCharge: 350, // ₹/kVA/month (lowest among major DC states)
    demandBillingRule: 'Standard: Higher of Actual MD or Contract Demand',
    timeSlots: [
      { name: 'Morning Normal', startHour: 6, endHour: 10, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Day Normal', startHour: 10, endHour: 18, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Evening Peak', startHour: 18, endHour: 22, type: 'peak', multiplier: 1.0, adder: 1.00 }, // +₹1/kWh
      { name: 'Night Off-Peak', startHour: 22, endHour: 6, type: 'off-peak', multiplier: 1.0, adder: -1.00 }, // -₹1/kWh
    ],
    fuelAdjustmentCharge: 0.28, // ₹/unit mid-range estimate (range: 0.20-0.35)
    fuelAdjustmentType: 'absolute',
    electricityDuty: 0.06, // 6%
    powerFactorPenaltyThreshold: 0.85,
    powerFactorPenaltyRate: 0.15,
    dgRate: 20.0,
    regulatoryStatus: 'Stable - KERC MYT Order 2025. BESCOM Additional Surcharge petition (₹1.65/unit for OA) pending.',
    notes: 'Symmetrical ±₹1.00 ToD structure: evening peak +₹1 (18-22) and night rebate -₹1 (22-06). 24x7 operations with flat load are ToD-neutral. Flat ₹6.60 rate (slab system abolished). Lowest demand charge (₹350) makes KA the cost leader for DC operations.'
  },
  {
    state: 'Telangana',
    stateCode: 'TS',
    discom: 'TGSPDCL / TSERC',
    category: 'HT-I(A) Industry General',
    billingUnit: 'kVAh',
    baseEnergyRate: 7.65, // ₹/kVAh at 11kV (TSERC RST Order 2025-26)
    wheelingCharge: 0, // Included in base for grid consumers
    demandCharge: 500, // ₹/kVA/month
    demandBillingRule: 'Higher of: Actual MD or Contract Demand. Customer charges: ₹2000 (11kV), ₹3500 (33kV), ₹5000 (132kV).',
    timeSlots: [
      { name: 'Morning Peak', startHour: 6, endHour: 10, type: 'peak', multiplier: 1.0, adder: 1.00 }, // +₹1/kVAh
      { name: 'Day Normal', startHour: 10, endHour: 18, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Evening Peak', startHour: 18, endHour: 22, type: 'peak', multiplier: 1.0, adder: 1.00 }, // +₹1/kVAh
      { name: 'Night', startHour: 22, endHour: 6, type: 'normal', multiplier: 1.0, adder: 0 }, // SUSPENDED: normally -₹1.50 rebate, suspended Dec 2025-Mar 2026
    ],
    fuelAdjustmentCharge: 0, // Negligible for Feb 2026
    fuelAdjustmentType: 'absolute',
    electricityDuty: 0.05, // 5%
    powerFactorPenaltyThreshold: 0.90,
    powerFactorPenaltyRate: 0.15,
    dgRate: 18.0,
    regulatoryStatus: 'Amendment Active - Night rebate (₹1.50) suspended Dec 2025-Mar 2026 due to thermal backing-down costs. Standard rebate resumes Apr 2026.',
    notes: 'kVAh billing. CRITICAL: Night ToD rebate (-₹1.50) SUSPENDED for winter (Dec 2025-Mar 2026). Night cost is now ₹7.65 instead of ₹6.15 — a 24.4% increase. Dual peak: morning 06-10 and evening 18-22 both at +₹1/kVAh. Cross Subsidy Surcharge for OA: ₹1.82/kWh. Voltage-based rates: 33kV ₹7.15, 132kV+ ₹6.65.'
  }
];

// Example scenarios for demonstration
export interface ExampleScenario {
  name: string;
  description: string;
  state: string;
  monthlyConsumption: number; // kWh
  contractedDemand: number; // kVA
  recordedDemand: number; // kVA
  powerFactor: number;
  pue: number;
  dgHours: number; // Hours of DG operation in the month
  dgConsumption: number; // kWh consumed during DG
  consumptionPattern: {
    peakPercent: number;
    normalPercent: number;
    offPeakPercent: number;
  };
}

export const exampleScenarios: ExampleScenario[] = [
  {
    name: 'Mumbai Colocation - 50 Racks',
    description: 'Mid-sized colocation facility in Mumbai (MSEDCL). kVAh billing with aggressive evening peak surcharge.',
    state: 'Maharashtra',
    monthlyConsumption: 180000, // 180 MWh
    contractedDemand: 400,
    recordedDemand: 380,
    powerFactor: 0.95,
    pue: 1.65,
    dgHours: 12,
    dgConsumption: 3000,
    consumptionPattern: {
      peakPercent: 35,
      normalPercent: 40,
      offPeakPercent: 25
    }
  },
  {
    name: 'Hyderabad Hyperscale - 200 Racks',
    description: 'Large hyperscale in Hyderabad (TGSPDCL). Note: Night rebate suspended for Feb 2026.',
    state: 'Telangana',
    monthlyConsumption: 720000, // 720 MWh
    contractedDemand: 1500,
    recordedDemand: 1420,
    powerFactor: 0.98,
    pue: 1.45,
    dgHours: 6,
    dgConsumption: 5000,
    consumptionPattern: {
      peakPercent: 30,
      normalPercent: 40,
      offPeakPercent: 30
    }
  },
  {
    name: 'Bengaluru Colo - 100 Racks',
    description: 'Enterprise colocation in Bengaluru (BESCOM). Lowest effective rate due to ₹6.60 base + symmetrical ToD.',
    state: 'Karnataka',
    monthlyConsumption: 360000, // 360 MWh
    contractedDemand: 800,
    recordedDemand: 750,
    powerFactor: 0.96,
    pue: 1.55,
    dgHours: 8,
    dgConsumption: 4000,
    consumptionPattern: {
      peakPercent: 25,
      normalPercent: 50,
      offPeakPercent: 25
    }
  },
  {
    name: 'Chennai DC - 75 Racks',
    description: 'Mid-sized facility in Chennai (TANGEDCO). Dual peak + 25% surcharge makes load shifting critical.',
    state: 'Tamil Nadu',
    monthlyConsumption: 270000, // 270 MWh
    contractedDemand: 600,
    recordedDemand: 560,
    powerFactor: 0.94,
    pue: 1.60,
    dgHours: 10,
    dgConsumption: 3500,
    consumptionPattern: {
      peakPercent: 35,
      normalPercent: 45,
      offPeakPercent: 20
    }
  }
];

// Utility function to calculate effective rate for a time slot
export function getEffectiveRate(baseRate: number, slot: TimeSlot): number {
  // Apply multiplier first, then adder
  return (baseRate * slot.multiplier) + slot.adder;
}

// Calculate total bill for a given consumption pattern
export interface BillBreakdown {
  energyCharges: {
    peak: number;
    normal: number;
    offPeak: number;
    total: number;
  };
  wheelingCharges: number;
  demandCharges: number;
  fuelAdjustment: number;
  electricityDuty: number;
  powerFactorPenalty: number;
  dgCharges: number;
  subtotal: number;
  gst: number;
  totalBill: number;
  effectiveRate: number; // ₹/kWh effective rate
}

export function calculateBill(
  tariff: StateTariff,
  consumption: number, // Total kWh (converted to kVAh internally if needed)
  peakPercent: number,
  normalPercent: number,
  offPeakPercent: number,
  contractedDemand: number,
  recordedDemand: number,
  powerFactor: number,
  dgConsumption: number
): BillBreakdown {
  // For kVAh states, convert consumption using power factor
  const billedConsumption = tariff.billingUnit === 'kVAh'
    ? consumption / powerFactor
    : consumption;

  // Calculate consumption per slot type
  const peakConsumption = billedConsumption * (peakPercent / 100);
  const normalConsumption = billedConsumption * (normalPercent / 100);
  const offPeakConsumption = billedConsumption * (offPeakPercent / 100);

  // Find average rates for each slot type
  const peakSlots = tariff.timeSlots.filter(s => s.type === 'peak');
  const normalSlots = tariff.timeSlots.filter(s => s.type === 'normal');
  const offPeakSlots = tariff.timeSlots.filter(s => s.type === 'off-peak');

  const avgPeakRate = peakSlots.length > 0
    ? peakSlots.reduce((sum, s) => sum + getEffectiveRate(tariff.baseEnergyRate, s), 0) / peakSlots.length
    : tariff.baseEnergyRate;
  const avgNormalRate = normalSlots.length > 0
    ? normalSlots.reduce((sum, s) => sum + getEffectiveRate(tariff.baseEnergyRate, s), 0) / normalSlots.length
    : tariff.baseEnergyRate;
  const avgOffPeakRate = offPeakSlots.length > 0
    ? offPeakSlots.reduce((sum, s) => sum + getEffectiveRate(tariff.baseEnergyRate, s), 0) / offPeakSlots.length
    : tariff.baseEnergyRate;

  // Energy charges
  const peakCharges = peakConsumption * avgPeakRate;
  const normalCharges = normalConsumption * avgNormalRate;
  const offPeakCharges = offPeakConsumption * avgOffPeakRate;
  const totalEnergyCharges = peakCharges + normalCharges + offPeakCharges;

  // Wheeling charges
  const wheelingCharges = billedConsumption * tariff.wheelingCharge;

  // Demand charges (based on billing demand rule)
  const billedDemand = Math.max(contractedDemand, recordedDemand);
  const demandCharges = billedDemand * tariff.demandCharge;

  // Fuel Adjustment Charge
  let fuelAdjustment: number;
  if (tariff.fuelAdjustmentType === 'percentage') {
    // FPPCA as percentage of energy charges (e.g., Tamil Nadu 1.58%)
    fuelAdjustment = totalEnergyCharges * (tariff.fuelAdjustmentCharge / 100);
  } else {
    fuelAdjustment = billedConsumption * tariff.fuelAdjustmentCharge;
  }

  // Power Factor Penalty (for kWh billing states with PF below threshold)
  let powerFactorPenalty = 0;
  if (powerFactor < tariff.powerFactorPenaltyThreshold) {
    const penaltyFactor = (tariff.powerFactorPenaltyThreshold - powerFactor) * 100;
    powerFactorPenalty = consumption * tariff.powerFactorPenaltyRate * (penaltyFactor / 10);
  }

  // DG Charges
  const dgCharges = dgConsumption * tariff.dgRate;

  // Subtotal before duty
  const subtotalBeforeDuty = totalEnergyCharges + wheelingCharges + demandCharges + fuelAdjustment + powerFactorPenalty + dgCharges;

  // Electricity Duty
  const electricityDuty = (totalEnergyCharges + wheelingCharges + demandCharges) * tariff.electricityDuty;

  // Subtotal after duty
  const subtotal = subtotalBeforeDuty + electricityDuty;

  // GST at 18%
  const gst = subtotal * 0.18;

  // Total Bill
  const totalBill = subtotal + gst;

  // Effective rate per kWh (always in kWh for comparability)
  const effectiveRate = totalBill / (consumption + dgConsumption);

  return {
    energyCharges: {
      peak: peakCharges,
      normal: normalCharges,
      offPeak: offPeakCharges,
      total: totalEnergyCharges
    },
    wheelingCharges,
    demandCharges,
    fuelAdjustment,
    electricityDuty,
    powerFactorPenalty,
    dgCharges,
    subtotal,
    gst,
    totalBill,
    effectiveRate
  };
}
