import { describe, it, expect } from 'vitest';
import { calculateBill } from '../../src/calculate.js';
import {
  maharashtraTariff,
  tamilNaduTariff,
  karnatakaTariff,
  telanganaTariff,
} from '../../src/fixtures/tariffs.js';
import { generateReadingsFromPattern, generateUniformReadings } from '../helpers.js';
import type { BillCalculationInput, BillOutput } from '../../src/types.js';

// Helper to create standard bill input from example scenario
function makeScenarioInput(
  tariff: typeof maharashtraTariff,
  consumption: number,
  pattern: { peakPercent: number; normalPercent: number; offPeakPercent: number },
  contractedDemand: number,
  recordedDemand: number,
  powerFactor: number,
  dgKWh: number,
  dgRate: number,
): BillCalculationInput {
  return {
    readings: generateReadingsFromPattern(consumption, pattern, tariff),
    tariff,
    contractedDemandKVA: contractedDemand,
    recordedDemandKVA: recordedDemand,
    powerFactor,
    dgKWh,
    dgRatePaisa: dgRate,
  };
}

describe('Golden File Bill Calculations', () => {
  let mhResult: BillOutput;
  let tsResult: BillOutput;
  let kaResult: BillOutput;
  let tnResult: BillOutput;

  it('BE-G01: Mumbai 50-rack — 180,000 kWh, PF 0.95', () => {
    const input = makeScenarioInput(
      maharashtraTariff,
      180000, { peakPercent: 35, normalPercent: 40, offPeakPercent: 25 },
      400, 380, 0.95, 3000, 2200,
    );
    mhResult = calculateBill(input);

    // Basic structural checks
    expect(mhResult.totalKWh).toBe(180000);
    expect(mhResult.billedKVAh).toBeGreaterThan(180000); // kVAh state, PF < 1
    expect(mhResult.totalBillPaisa).toBeGreaterThan(0);
    expect(mhResult.totalBillPaisa).toBe(mhResult.subtotalPaisa + mhResult.gstPaisa);

    // Verify energy charges sum
    expect(mhResult.totalEnergyChargesPaisa).toBe(
      mhResult.peakChargesPaisa + mhResult.normalChargesPaisa + mhResult.offPeakChargesPaisa,
    );

    // Demand should be max(380, 300, 50) = 380
    expect(mhResult.billedDemandKVA).toBe(380);
  });

  it('BE-G02: Hyderabad 200-rack — 720,000 kWh, PF 0.98', () => {
    const input = makeScenarioInput(
      telanganaTariff,
      720000, { peakPercent: 30, normalPercent: 70, offPeakPercent: 0 }, // TS has no off-peak slots (night rebate suspended)
      1500, 1420, 0.98, 5000, 1800,
    );
    tsResult = calculateBill(input);

    expect(tsResult.totalKWh).toBe(720000);
    expect(tsResult.billedKVAh).toBeGreaterThan(720000); // kVAh state
    expect(tsResult.totalBillPaisa).toBeGreaterThan(0);
    expect(tsResult.totalBillPaisa).toBe(tsResult.subtotalPaisa + tsResult.gstPaisa);

    // Demand should be max(1420, 1500*1.0=1500, 0) = 1500
    expect(tsResult.billedDemandKVA).toBe(1500);
  });

  it('BE-G03: Bengaluru 100-rack — 360,000 kWh, PF 0.96', () => {
    const input = makeScenarioInput(
      karnatakaTariff,
      360000, { peakPercent: 25, normalPercent: 50, offPeakPercent: 25 },
      800, 750, 0.96, 4000, 2000,
    );
    kaResult = calculateBill(input);

    expect(kaResult.totalKWh).toBe(360000);
    expect(kaResult.billedKVAh).toBeNull(); // kWh state
    expect(kaResult.totalBillPaisa).toBeGreaterThan(0);

    // Demand should be max(750, 800*1.0=800, 0) = 800
    expect(kaResult.billedDemandKVA).toBe(800);
  });

  it('BE-G04: Chennai 75-rack — 270,000 kWh, PF 0.94', () => {
    const input = makeScenarioInput(
      tamilNaduTariff,
      270000, { peakPercent: 35, normalPercent: 45, offPeakPercent: 20 },
      600, 560, 0.94, 3500, 2400,
    );
    tnResult = calculateBill(input);

    expect(tnResult.totalKWh).toBe(270000);
    expect(tnResult.billedKVAh).toBeNull(); // kWh state
    expect(tnResult.totalBillPaisa).toBeGreaterThan(0);

    // Demand should be max(560, 600*0.9=540, 0) = 560
    expect(tnResult.billedDemandKVA).toBe(560);
  });

  it('BE-G05: Zero consumption — KA, demand charge only, total > 0', () => {
    const input: BillCalculationInput = {
      readings: [],
      tariff: karnatakaTariff,
      contractedDemandKVA: 800,
      recordedDemandKVA: 0,
      powerFactor: 0.96,
      dgKWh: 0,
      dgRatePaisa: 2000,
    };
    const result = calculateBill(input);

    expect(result.totalKWh).toBe(0);
    expect(result.totalEnergyChargesPaisa).toBe(0);
    expect(result.demandChargesPaisa).toBeGreaterThan(0);
    expect(result.totalBillPaisa).toBeGreaterThan(0);
    // Demand = max(0, 800*1.0=800, 0) = 800
    expect(result.billedDemandKVA).toBe(800);
  });

  it('BE-G06: 100% peak — MH, highest possible effective rate', () => {
    const peakReadings = generateUniformReadings(180000, 'peak', maharashtraTariff);
    const input: BillCalculationInput = {
      readings: peakReadings,
      tariff: maharashtraTariff,
      contractedDemandKVA: 400,
      recordedDemandKVA: 380,
      powerFactor: 0.95,
      dgKWh: 0,
      dgRatePaisa: 2200,
    };
    const peakResult = calculateBill(input);

    // Compare with mixed pattern
    const mixedReadings = generateReadingsFromPattern(
      180000, { peakPercent: 33, normalPercent: 34, offPeakPercent: 33 }, maharashtraTariff,
    );
    const mixedInput: BillCalculationInput = {
      ...input,
      readings: mixedReadings,
    };
    const mixedResult = calculateBill(mixedInput);

    // 100% peak should have higher energy charges
    expect(peakResult.totalEnergyChargesPaisa).toBeGreaterThan(mixedResult.totalEnergyChargesPaisa);
  });

  it('BE-G07: 100% off-peak — MH, lowest possible effective rate', () => {
    const offPeakReadings = generateUniformReadings(180000, 'off-peak', maharashtraTariff);
    const input: BillCalculationInput = {
      readings: offPeakReadings,
      tariff: maharashtraTariff,
      contractedDemandKVA: 400,
      recordedDemandKVA: 380,
      powerFactor: 0.95,
      dgKWh: 0,
      dgRatePaisa: 2200,
    };
    const offPeakResult = calculateBill(input);

    const mixedReadings = generateReadingsFromPattern(
      180000, { peakPercent: 33, normalPercent: 34, offPeakPercent: 33 }, maharashtraTariff,
    );
    const mixedInput: BillCalculationInput = {
      ...input,
      readings: mixedReadings,
    };
    const mixedResult = calculateBill(mixedInput);

    // 100% off-peak should have lower energy charges
    expect(offPeakResult.totalEnergyChargesPaisa).toBeLessThan(mixedResult.totalEnergyChargesPaisa);
  });

  it('BE-G08: PF penalty trigger — TN, PF 0.80, penalty > 0', () => {
    const input = makeScenarioInput(
      tamilNaduTariff,
      270000, { peakPercent: 35, normalPercent: 45, offPeakPercent: 20 },
      600, 560, 0.80, 0, 2400,
    );
    const result = calculateBill(input);

    // PF 0.80 < threshold 0.90 → penalty should be positive
    expect(result.pfPenaltyPaisa).toBeGreaterThan(0);
  });
});
