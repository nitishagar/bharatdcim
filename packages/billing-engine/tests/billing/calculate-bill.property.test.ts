import { describe, it, expect } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import { calculateBill } from '../../src/calculate.js';
import {
  maharashtraTariff,
  tamilNaduTariff,
  karnatakaTariff,
  telanganaTariff,
} from '../../src/fixtures/tariffs.js';
import { generateReadingsFromPattern } from '../helpers.js';
import type { BillCalculationInput, TariffConfig } from '../../src/types.js';

const allTariffs = [maharashtraTariff, tamilNaduTariff, karnatakaTariff, telanganaTariff];

function makeInput(
  tariff: TariffConfig,
  totalKWh: number,
  peakPercent: number,
  normalPercent: number,
  offPeakPercent: number,
  powerFactor: number,
): BillCalculationInput {
  const readings = generateReadingsFromPattern(
    totalKWh,
    { peakPercent, normalPercent, offPeakPercent },
    tariff,
  );
  return {
    readings,
    tariff,
    contractedDemandKVA: 400,
    recordedDemandKVA: 380,
    powerFactor,
    dgKWh: 0,
    dgRatePaisa: 2200,
  };
}

describe('Property-Based Billing Tests', () => {
  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1, max: 1000000 }),
    fc.integer({ min: 0, max: 100 }),
    fc.integer({ min: 0, max: 100 }),
  ])('BE-P01: Energy conservation — peak + normal + offPeak === total (±0.001)', (tariff, totalKWh, peakRaw, normalRaw) => {
    const total = Math.max(peakRaw + normalRaw, 1);
    const peakPercent = Math.round((peakRaw / total) * 100);
    const normalPercent = Math.round((normalRaw / total) * 100);
    const offPeakPercent = 100 - peakPercent - normalPercent;

    if (offPeakPercent < 0) return; // skip invalid combos

    const input = makeInput(tariff, totalKWh, peakPercent, normalPercent, offPeakPercent, 0.95);
    const result = calculateBill(input);

    expect(Math.abs(result.peakKWh + result.normalKWh + result.offPeakKWh - result.totalKWh)).toBeLessThan(0.001);
  });

  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1, max: 500000 }),
  ])('BE-P02: Non-negative charges — all charge components ≥ 0', (tariff, totalKWh) => {
    const input = makeInput(tariff, totalKWh, 33, 34, 33, 0.95);
    const result = calculateBill(input);

    expect(result.totalEnergyChargesPaisa).toBeGreaterThanOrEqual(0);
    expect(result.wheelingChargesPaisa).toBeGreaterThanOrEqual(0);
    expect(result.demandChargesPaisa).toBeGreaterThanOrEqual(0);
    expect(result.fuelAdjustmentPaisa).toBeGreaterThanOrEqual(0);
    expect(result.electricityDutyPaisa).toBeGreaterThanOrEqual(0);
    expect(result.pfPenaltyPaisa).toBeGreaterThanOrEqual(0);
    expect(result.dgChargesPaisa).toBeGreaterThanOrEqual(0);
    expect(result.gstPaisa).toBeGreaterThanOrEqual(0);
    expect(result.totalBillPaisa).toBeGreaterThanOrEqual(0);
  });

  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1, max: 500000 }),
  ])('BE-P03: Total = sum of parts — subtotal + gst = total', (tariff, totalKWh) => {
    const input = makeInput(tariff, totalKWh, 33, 34, 33, 0.95);
    const result = calculateBill(input);

    const expectedSubtotal =
      result.totalEnergyChargesPaisa +
      result.wheelingChargesPaisa +
      result.demandChargesPaisa +
      result.fuelAdjustmentPaisa +
      result.electricityDutyPaisa +
      result.pfPenaltyPaisa +
      result.dgChargesPaisa;

    expect(result.subtotalPaisa).toBe(expectedSubtotal);
    expect(result.totalBillPaisa).toBe(result.subtotalPaisa + result.gstPaisa);
  });

  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1, max: 500000 }),
  ])('BE-P04: GST = 18% of subtotal (±1 paisa rounding)', (tariff, totalKWh) => {
    const input = makeInput(tariff, totalKWh, 33, 34, 33, 0.95);
    const result = calculateBill(input);

    const expectedGst = Math.round(result.subtotalPaisa * 18 / 100);
    expect(Math.abs(result.gstPaisa - expectedGst)).toBeLessThanOrEqual(1);
  });

  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 100000, max: 1000000 }), // min 100k kWh to avoid demand charge domination
  ])('BE-P05: Effective rate bounded — 6.00 ≤ effectiveRate ≤ 25.00 ₹/kWh', (tariff, totalKWh) => {
    const input = makeInput(tariff, totalKWh, 33, 34, 33, 0.95);
    const result = calculateBill(input);

    // Effective rate in ₹/kWh = effectiveRatePaisaPerKWh / 100
    const effectiveRateRs = result.effectiveRatePaisaPerKWh / 100;
    expect(effectiveRateRs).toBeGreaterThanOrEqual(6.0);
    expect(effectiveRateRs).toBeLessThanOrEqual(25.0);
  });

  fcTest.prop([
    fc.constantFrom(maharashtraTariff, telanganaTariff), // kVAh states
    fc.integer({ min: 1000, max: 500000 }),
  ])('BE-P06: kVAh ≥ kWh — for kVAh states', (tariff, totalKWh) => {
    const input = makeInput(tariff, totalKWh, 33, 34, 33, 0.95);
    const result = calculateBill(input);

    expect(result.billedKVAh).not.toBeNull();
    expect(result.billedKVAh!).toBeGreaterThanOrEqual(result.totalKWh);
  });

  it('BE-P07: Higher PF → lower bill — for kVAh states', () => {
    // bill(PF=0.98) < bill(PF=0.85) same consumption
    const inputHighPF = makeInput(maharashtraTariff, 180000, 35, 40, 25, 0.98);
    const inputLowPF = makeInput(maharashtraTariff, 180000, 35, 40, 25, 0.85);

    const resultHighPF = calculateBill(inputHighPF);
    const resultLowPF = calculateBill(inputLowPF);

    expect(resultHighPF.totalBillPaisa).toBeLessThan(resultLowPF.totalBillPaisa);
  });

  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1000, max: 250000 }),
  ])('BE-P08: Monotonic consumption — more kWh → higher bill', (tariff, totalKWh) => {
    const input1 = makeInput(tariff, totalKWh, 33, 34, 33, 0.95);
    const input2 = makeInput(tariff, totalKWh * 2, 33, 34, 33, 0.95);

    const result1 = calculateBill(input1);
    const result2 = calculateBill(input2);

    expect(result2.totalBillPaisa).toBeGreaterThan(result1.totalBillPaisa);
  });
});
