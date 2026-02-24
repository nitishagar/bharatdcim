import type { TariffConfig } from '../types.js';

export const maharashtraTariff: TariffConfig = {
  id: 'mh-htia-2025',
  stateCode: 'MH',
  discom: 'MSEDCL / MERC',
  category: 'HT I(A) Industry (General)',
  effectiveFrom: '2025-01-01',
  effectiveTo: null,
  billingUnit: 'kVAh',
  baseEnergyRatePaisa: 868, // ₹8.68 (MERC Case 75/2025, post-review petition)
  wheelingChargePaisa: 74, // ₹0.74
  demandChargePerKVAPaisa: 60000, // ₹600
  demandRatchetPercent: 75,
  minimumDemandKVA: 50,
  timeSlots: [
    {
      name: 'Night Off-Peak',
      startHour: 22, startMinute: 0,
      endHour: 6, endMinute: 0,
      type: 'off-peak',
      multiplierBps: 10000,
      adderPaisa: -150,
    },
    {
      name: 'Morning Normal',
      startHour: 6, startMinute: 0,
      endHour: 9, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Morning Peak',
      startHour: 9, startMinute: 0,
      endHour: 12, endMinute: 0,
      type: 'peak',
      multiplierBps: 10000,
      adderPaisa: 80,
    },
    {
      name: 'Solar Hours',
      startHour: 12, startMinute: 0,
      endHour: 18, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Evening Peak',
      startHour: 18, startMinute: 0,
      endHour: 22, endMinute: 0,
      type: 'peak',
      multiplierBps: 10000,
      adderPaisa: 110,
    },
  ],
  fuelAdjustmentPaisa: 72, // ₹0.72
  fuelAdjustmentType: 'absolute',
  electricityDutyBps: 930, // 9.30% (Maharashtra Electricity Duty Act 2016, Industrial Part F)
  pfThresholdBps: 9000, // 0.90
  pfPenaltyRatePaisa: 25, // ₹0.25
  version: 1,
};

export const tamilNaduTariff: TariffConfig = {
  id: 'tn-hti-2025',
  stateCode: 'TN',
  discom: 'TANGEDCO / TNERC',
  category: 'HT Tariff I – Industries',
  effectiveFrom: '2025-07-01',
  effectiveTo: null,
  billingUnit: 'kWh',
  baseEnergyRatePaisa: 750, // ₹7.50
  wheelingChargePaisa: 104, // ₹1.04
  demandChargePerKVAPaisa: 60800, // ₹608
  demandRatchetPercent: 90,
  minimumDemandKVA: 0,
  timeSlots: [
    {
      name: 'Night Off-Peak',
      startHour: 22, startMinute: 0,
      endHour: 5, endMinute: 0,
      type: 'off-peak',
      multiplierBps: 9500, // 0.95x = -5% rebate
      adderPaisa: 0,
    },
    {
      name: 'Early Morning',
      startHour: 5, startMinute: 0,
      endHour: 6, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Morning Peak',
      startHour: 6, startMinute: 0,
      endHour: 10, endMinute: 0,
      type: 'peak',
      multiplierBps: 12500, // 1.25x = +25% surcharge
      adderPaisa: 0,
    },
    {
      name: 'Normal',
      startHour: 10, startMinute: 0,
      endHour: 18, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Evening Peak',
      startHour: 18, startMinute: 0,
      endHour: 22, endMinute: 0,
      type: 'peak',
      multiplierBps: 12500, // 1.25x = +25% surcharge
      adderPaisa: 0,
    },
  ],
  fuelAdjustmentPaisa: 158, // 1.58% expressed as bps for percentage type
  fuelAdjustmentType: 'percentage',
  electricityDutyBps: 500, // 5%
  pfThresholdBps: 9000, // 0.90
  pfPenaltyRatePaisa: 20, // ₹0.20
  version: 1,
};

export const karnatakaTariff: TariffConfig = {
  id: 'ka-ht2a-2025',
  stateCode: 'KA',
  discom: 'BESCOM / KERC',
  category: 'HT-2(a) Industries',
  effectiveFrom: '2025-01-01',
  effectiveTo: null,
  billingUnit: 'kWh',
  baseEnergyRatePaisa: 660, // ₹6.60
  wheelingChargePaisa: 0, // Included in base
  demandChargePerKVAPaisa: 35000, // ₹350
  demandRatchetPercent: 100,
  minimumDemandKVA: 0,
  timeSlots: [
    {
      name: 'Morning Normal',
      startHour: 6, startMinute: 0,
      endHour: 10, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Day Normal',
      startHour: 10, startMinute: 0,
      endHour: 18, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Evening Peak',
      startHour: 18, startMinute: 0,
      endHour: 22, endMinute: 0,
      type: 'peak',
      multiplierBps: 10000,
      adderPaisa: 100,
    },
    {
      name: 'Night Off-Peak',
      startHour: 22, startMinute: 0,
      endHour: 6, endMinute: 0,
      type: 'off-peak',
      multiplierBps: 10000,
      adderPaisa: -100,
    },
  ],
  fuelAdjustmentPaisa: 28, // ₹0.28
  fuelAdjustmentType: 'absolute',
  electricityDutyBps: 600, // 6%
  pfThresholdBps: 9000, // 0.90 — HT threshold; 0.85 applies only to LT (KERC Tariff Order 2025)
  pfPenaltyRatePaisa: 15, // ₹0.15
  version: 1,
};

export const telanganaTariff: TariffConfig = {
  id: 'ts-htia-2025',
  stateCode: 'TS',
  discom: 'TGSPDCL / TSERC',
  category: 'HT-I(A) Industry General',
  effectiveFrom: '2025-04-01',
  effectiveTo: null,
  billingUnit: 'kVAh',
  baseEnergyRatePaisa: 765, // ₹7.65
  wheelingChargePaisa: 0, // Included in base
  demandChargePerKVAPaisa: 50000, // ₹500
  demandRatchetPercent: 100,
  minimumDemandKVA: 0,
  timeSlots: [
    {
      name: 'Morning Peak',
      startHour: 6, startMinute: 0,
      endHour: 10, endMinute: 0,
      type: 'peak',
      multiplierBps: 10000,
      adderPaisa: 100, // +₹1/kVAh
    },
    {
      name: 'Day Normal',
      startHour: 10, startMinute: 0,
      endHour: 18, endMinute: 0,
      type: 'normal',
      multiplierBps: 10000,
      adderPaisa: 0,
    },
    {
      name: 'Evening Peak',
      startHour: 18, startMinute: 0,
      endHour: 22, endMinute: 0,
      type: 'peak',
      multiplierBps: 10000,
      adderPaisa: 100, // +₹1/kVAh
    },
    {
      name: 'Night',
      startHour: 22, startMinute: 0,
      endHour: 6, endMinute: 0,
      type: 'normal', // SUSPENDED: normally off-peak with -₹1.50 rebate
      multiplierBps: 10000,
      adderPaisa: 0, // Rebate suspended Dec 2025-Mar 2026
    },
  ],
  fuelAdjustmentPaisa: 0, // Negligible for Feb 2026
  fuelAdjustmentType: 'absolute',
  electricityDutyBps: 500, // 5%
  pfThresholdBps: 9000, // 0.90
  pfPenaltyRatePaisa: 15, // ₹0.15
  version: 1,
};

/** All tariff fixtures indexed by state code */
export const tariffFixtures: Record<string, TariffConfig> = {
  MH: maharashtraTariff,
  TN: tamilNaduTariff,
  KA: karnatakaTariff,
  TS: telanganaTariff,
};
