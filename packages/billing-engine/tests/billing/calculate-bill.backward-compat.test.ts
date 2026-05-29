import { describe, expect } from 'vitest';
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

function makeInputNoOA(
  tariff: TariffConfig,
  totalKWh: number,
): BillCalculationInput {
  const readings = generateReadingsFromPattern(
    totalKWh,
    { peakPercent: 33, normalPercent: 34, offPeakPercent: 33 },
    tariff,
  );
  return {
    readings,
    tariff,
    contractedDemandKVA: 400,
    recordedDemandKVA: 380,
    powerFactor: 0.95,
    dgKWh: 0,
    dgRatePaisa: 0,
    // No powerSources — OA path must not activate
  };
}

describe('Backward-compatibility: no OA inputs → zero OA output', () => {
  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1, max: 500000 }),
  ])('BC-01: OA fields are zero/empty when powerSources is absent', (tariff, totalKWh) => {
    const input = makeInputNoOA(tariff, totalKWh);
    const result = calculateBill(input);

    expect(result.ppaEnergyChargesPaisa).toBe(0);
    expect(result.crossSubsidySurchargePaisa).toBe(0);
    expect(result.additionalSurchargePaisa).toBe(0);
    expect(result.transmissionLossChargesPaisa).toBe(0);
    expect(result.sourceBreakdown).toHaveLength(0);
  });

  fcTest.prop([
    fc.constantFrom(...allTariffs),
    fc.integer({ min: 1, max: 500000 }),
  ])('BC-02: subtotal unchanged — includes new zero fields, total = subtotal + gst', (tariff, totalKWh) => {
    const input = makeInputNoOA(tariff, totalKWh);
    const result = calculateBill(input);

    const expectedSubtotal =
      result.totalEnergyChargesPaisa +
      result.wheelingChargesPaisa +
      result.demandChargesPaisa +
      result.fuelAdjustmentPaisa +
      result.electricityDutyPaisa +
      result.pfPenaltyPaisa +
      result.dgChargesPaisa +
      result.ppaEnergyChargesPaisa +
      result.crossSubsidySurchargePaisa +
      result.additionalSurchargePaisa +
      result.transmissionLossChargesPaisa;

    expect(result.subtotalPaisa).toBe(expectedSubtotal);
    expect(result.totalBillPaisa).toBe(result.subtotalPaisa + result.gstPaisa);
  });
});
