// Indian State-wise Data Center Power Tariff Data
// Source: State Electricity Regulatory Commissions (MERC, TNERC, KERC, TSERC)
// Note: These are representative rates for FY 2025-26. Actual rates may vary.

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
  baseEnergyRate: number; // ₹/kWh or ₹/kVAh
  demandCharge: number; // ₹/kVA/month
  timeSlots: TimeSlot[];
  fuelAdjustmentCharge: number; // ₹/unit (FAC)
  electricityDuty: number; // Percentage
  powerFactorPenaltyThreshold: number; // Below this PF, penalty applies
  powerFactorPenaltyRate: number; // ₹/kVAh penalty
  dgRate: number; // Typical DG power rate ₹/kWh
  notes: string;
}

export const stateTariffs: StateTariff[] = [
  {
    state: 'Maharashtra',
    stateCode: 'MH',
    discom: 'MSEDCL / MERC',
    category: 'HT Industrial / Commercial',
    baseEnergyRate: 8.20, // ₹/kVAh
    demandCharge: 400, // ₹/kVA/month
    timeSlots: [
      { name: 'Off-Peak', startHour: 0, endHour: 6, type: 'off-peak', multiplier: 1.0, adder: 0 },
      { name: 'Normal', startHour: 6, endHour: 9, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Solar Hours', startHour: 9, endHour: 17, type: 'off-peak', multiplier: 0.85, adder: 0 }, // 15% rebate
      { name: 'Peak', startHour: 17, endHour: 24, type: 'peak', multiplier: 1.25, adder: 0 }, // +25% surcharge
    ],
    fuelAdjustmentCharge: 0.15,
    electricityDuty: 0.16, // 16%
    powerFactorPenaltyThreshold: 0.90,
    powerFactorPenaltyRate: 0.25,
    dgRate: 22.0,
    notes: 'Peak hours 17:00-24:00 with +25% ToD surcharge. Solar hours (09:00-17:00) receive 15% rebate. Data centers using 100% green energy get 10% wheeling discount.'
  },
  {
    state: 'Tamil Nadu',
    stateCode: 'TN',
    discom: 'TANGEDCO / TNERC',
    category: 'HT Industrial',
    baseEnergyRate: 7.50, // ₹/kWh
    demandCharge: 608, // ₹/kVA/month - highest in India
    timeSlots: [
      { name: 'Night Off-Peak', startHour: 22, endHour: 5, type: 'off-peak', multiplier: 0.95, adder: 0 }, // 5% rebate
      { name: 'Normal', startHour: 5, endHour: 6, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Morning Peak', startHour: 6, endHour: 10, type: 'peak', multiplier: 1.25, adder: 0 }, // +25% surcharge
      { name: 'Normal', startHour: 10, endHour: 18, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Evening Peak', startHour: 18, endHour: 22, type: 'peak', multiplier: 1.25, adder: 0 }, // +25% surcharge
    ],
    fuelAdjustmentCharge: 0.12,
    electricityDuty: 0.05, // 5%
    powerFactorPenaltyThreshold: 0.90,
    powerFactorPenaltyRate: 0.20,
    dgRate: 24.0,
    notes: 'Dual peak windows (06:00-10:00 and 18:00-22:00) with +25% surcharge. Night hours (22:00-05:00) earn 5% rebate. Annual revision capped at 6%.'
  },
  {
    state: 'Karnataka',
    stateCode: 'KA',
    discom: 'BESCOM / KERC',
    category: 'HT Industrial',
    baseEnergyRate: 6.90, // ₹/kWh - comparatively lower
    demandCharge: 350, // ₹/kVA/month
    timeSlots: [
      { name: 'Night Incentive', startHour: 22, endHour: 6, type: 'off-peak', multiplier: 1.0, adder: -1.0 }, // ₹1/unit rebate
      { name: 'Morning Peak', startHour: 6, endHour: 9, type: 'peak', multiplier: 1.20, adder: 0 }, // +20% surcharge
      { name: 'Normal', startHour: 9, endHour: 18, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Evening Peak', startHour: 18, endHour: 22, type: 'peak', multiplier: 1.20, adder: 0 }, // +20% surcharge
    ],
    fuelAdjustmentCharge: 0.10,
    electricityDuty: 0.06, // 6%
    powerFactorPenaltyThreshold: 0.85,
    powerFactorPenaltyRate: 0.15,
    dgRate: 20.0,
    notes: 'Morning peak (06:00-09:00) and evening peak (18:00-22:00) with +20% surcharge. Night consumption incentive of ₹1/unit. Data centers receive industrial tariff classification as state incentive.'
  },
  {
    state: 'Telangana',
    stateCode: 'TS',
    discom: 'TSDISCOM / TSERC',
    category: 'HT Industrial',
    baseEnergyRate: 6.60, // ₹/unit - one of India's cheapest
    demandCharge: 320, // ₹/kVA/month
    timeSlots: [
      { name: 'Off-Peak Night', startHour: 22, endHour: 6, type: 'off-peak', multiplier: 1.0, adder: -1.50 }, // -₹1.50/unit
      { name: 'Normal Morning', startHour: 6, endHour: 9, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Normal Day', startHour: 9, endHour: 17, type: 'normal', multiplier: 1.0, adder: 0 },
      { name: 'Peak', startHour: 17, endHour: 22, type: 'peak', multiplier: 1.0, adder: 1.00 }, // +₹1/unit
    ],
    fuelAdjustmentCharge: 0.08,
    electricityDuty: 0.05, // 5%
    powerFactorPenaltyThreshold: 0.90,
    powerFactorPenaltyRate: 0.15,
    dgRate: 18.0,
    notes: 'Uses absolute adders: +₹1.00/unit during peak (17:00-22:00) and -₹1.50/unit during off-peak night (22:00-06:00). One of India\'s cheapest states for data center power.'
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
    description: 'Mid-sized colocation facility in Mumbai with typical enterprise load pattern. Higher peak consumption due to business hours.',
    state: 'Maharashtra',
    monthlyConsumption: 180000, // 180 MWh
    contractedDemand: 400,
    recordedDemand: 380,
    powerFactor: 0.92,
    pue: 1.65,
    dgHours: 12,
    dgConsumption: 3000,
    consumptionPattern: {
      peakPercent: 45,
      normalPercent: 30,
      offPeakPercent: 25
    }
  },
  {
    name: 'Hyderabad Hyperscale - 200 Racks',
    description: 'Large hyperscale facility in Hyderabad optimized for off-peak operations. Lower costs due to load shifting to night hours.',
    state: 'Telangana',
    monthlyConsumption: 720000, // 720 MWh
    contractedDemand: 1500,
    recordedDemand: 1420,
    powerFactor: 0.95,
    pue: 1.45,
    dgHours: 6,
    dgConsumption: 5000,
    consumptionPattern: {
      peakPercent: 25,
      normalPercent: 35,
      offPeakPercent: 40
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
  consumption: number, // Total kWh
  peakPercent: number,
  normalPercent: number,
  offPeakPercent: number,
  contractedDemand: number,
  recordedDemand: number,
  powerFactor: number,
  dgConsumption: number
): BillBreakdown {
  // Calculate consumption per slot type
  const peakConsumption = consumption * (peakPercent / 100);
  const normalConsumption = consumption * (normalPercent / 100);
  const offPeakConsumption = consumption * (offPeakPercent / 100);

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

  // Demand charges (based on higher of contracted or recorded)
  const billedDemand = Math.max(contractedDemand, recordedDemand);
  const demandCharges = billedDemand * tariff.demandCharge;

  // Fuel Adjustment Charge
  const fuelAdjustment = consumption * tariff.fuelAdjustmentCharge;

  // Power Factor Penalty
  let powerFactorPenalty = 0;
  if (powerFactor < tariff.powerFactorPenaltyThreshold) {
    // Simplified penalty calculation
    const penaltyFactor = (tariff.powerFactorPenaltyThreshold - powerFactor) * 100;
    powerFactorPenalty = consumption * tariff.powerFactorPenaltyRate * (penaltyFactor / 10);
  }

  // DG Charges
  const dgCharges = dgConsumption * tariff.dgRate;

  // Subtotal before duty
  const subtotalBeforeDuty = totalEnergyCharges + demandCharges + fuelAdjustment + powerFactorPenalty + dgCharges;

  // Electricity Duty
  const electricityDuty = (totalEnergyCharges + demandCharges) * tariff.electricityDuty;

  // Subtotal after duty
  const subtotal = subtotalBeforeDuty + electricityDuty;

  // GST at 18%
  const gst = subtotal * 0.18;

  // Total Bill
  const totalBill = subtotal + gst;

  // Effective rate
  const effectiveRate = totalBill / (consumption + dgConsumption);

  return {
    energyCharges: {
      peak: peakCharges,
      normal: normalCharges,
      offPeak: offPeakCharges,
      total: totalEnergyCharges
    },
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
