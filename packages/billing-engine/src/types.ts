// All monetary values are in INTEGER paisa (1 rupee = 100 paisa)
// Use Decimal.js for intermediate arithmetic, Math.round() to convert back

/**
 * TariffConfig — stored as versioned JSON, loaded from database.
 * Represents a complete tariff configuration for a state/discom/category.
 */
export interface TariffConfig {
  id: string;
  stateCode: string; // 'MH', 'TN', 'KA', 'TS'
  discom: string;
  category: string;
  effectiveFrom: string; // ISO date
  effectiveTo: string | null; // null = current
  billingUnit: 'kWh' | 'kVAh';
  baseEnergyRatePaisa: number; // INTEGER paisa
  wheelingChargePaisa: number;
  demandChargePerKVAPaisa: number;
  demandRatchetPercent: number; // 75 for MH, 90 for TN, 100 for KA/TS
  minimumDemandKVA: number; // 50 for MH, 0 for others
  timeSlots: TimeSlotConfig[];
  fuelAdjustmentPaisa: number;
  fuelAdjustmentType: 'absolute' | 'percentage';
  electricityDutyBps: number; // basis points: 1600 = 16%
  pfThresholdBps: number; // basis points: 9000 = 0.90
  pfPenaltyRatePaisa: number;
  version: number;
}

export interface TimeSlotConfig {
  name: string;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number;
  endMinute: number;
  type: 'peak' | 'normal' | 'off-peak';
  multiplierBps: number; // basis points: 10000 = 1.0x, 12500 = 1.25x
  adderPaisa: number; // INTEGER paisa
}

/** Output from ToD classification for a single reading */
export interface ClassifiedReading {
  timestamp: string;
  kWh: number;
  slotName: string;
  slotType: 'peak' | 'normal' | 'off-peak';
  ratePaisa: number;
}

/** Result of classifying a single timestamp */
export interface SlotClassification {
  slotName: string;
  slotType: 'peak' | 'normal' | 'off-peak';
  ratePaisa: number;
}

/** Input to calculateBill */
export interface BillCalculationInput {
  readings: ClassifiedReading[];
  tariff: TariffConfig;
  contractedDemandKVA: number;
  recordedDemandKVA: number;
  powerFactor: number; // 0.0 - 1.0
  dgKWh: number;
  dgRatePaisa: number;
}

/** Output: all values in integer paisa */
export interface BillOutput {
  peakKWh: number;
  normalKWh: number;
  offPeakKWh: number;
  totalKWh: number;
  billedKVAh: number | null;
  peakChargesPaisa: number;
  normalChargesPaisa: number;
  offPeakChargesPaisa: number;
  totalEnergyChargesPaisa: number;
  wheelingChargesPaisa: number;
  demandChargesPaisa: number;
  billedDemandKVA: number;
  fuelAdjustmentPaisa: number;
  electricityDutyPaisa: number;
  pfPenaltyPaisa: number;
  dgChargesPaisa: number;
  subtotalPaisa: number;
  gstPaisa: number;
  totalBillPaisa: number;
  effectiveRatePaisaPerKWh: number;
}
