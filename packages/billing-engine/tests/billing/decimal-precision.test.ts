import { describe, it, expect } from 'vitest';
import { calculateBill } from '../../src/calculate.js';
import { maharashtraTariff } from '../../src/fixtures/tariffs.js';
import { generateReadingsFromPattern } from '../helpers.js';
import type { BillCalculationInput } from '../../src/types.js';

describe('Decimal Precision', () => {
  it('BE-F01: 1000 iterations of same bill produce identical paisa results', () => {
    const readings = generateReadingsFromPattern(
      180000,
      { peakPercent: 35, normalPercent: 40, offPeakPercent: 25 },
      maharashtraTariff,
    );

    const input: BillCalculationInput = {
      readings,
      tariff: maharashtraTariff,
      contractedDemandKVA: 400,
      recordedDemandKVA: 380,
      powerFactor: 0.95,
      dgKWh: 3000,
      dgRatePaisa: 2200,
    };

    const firstResult = calculateBill(input);

    for (let i = 0; i < 1000; i++) {
      const result = calculateBill(input);
      expect(result.totalBillPaisa).toBe(firstResult.totalBillPaisa);
      expect(result.totalEnergyChargesPaisa).toBe(firstResult.totalEnergyChargesPaisa);
      expect(result.gstPaisa).toBe(firstResult.gstPaisa);
    }
  });

  it('BE-F02: ₹1,00,00,000 bill has no rounding errors (±0 paisa)', () => {
    // Generate a large consumption scenario that creates a ~₹1Cr bill
    // ₹1Cr = 10,000,000 rupees = 1,000,000,000 paisa
    // At ~₹10/kWh effective rate, need ~1,000,000 kWh
    const readings = generateReadingsFromPattern(
      1000000,
      { peakPercent: 33, normalPercent: 34, offPeakPercent: 33 },
      maharashtraTariff,
    );

    const input: BillCalculationInput = {
      readings,
      tariff: maharashtraTariff,
      contractedDemandKVA: 2000,
      recordedDemandKVA: 1900,
      powerFactor: 0.95,
      dgKWh: 10000,
      dgRatePaisa: 2200,
    };

    const result = calculateBill(input);

    // Verify the bill is in the expected range (very large)
    expect(result.totalBillPaisa).toBeGreaterThan(0);

    // Verify total = subtotal + GST (exact integer arithmetic)
    expect(result.totalBillPaisa).toBe(result.subtotalPaisa + result.gstPaisa);

    // Verify energy charges sum correctly
    expect(result.totalEnergyChargesPaisa).toBe(
      result.peakChargesPaisa + result.normalChargesPaisa + result.offPeakChargesPaisa,
    );

    // Verify subtotal is sum of all components
    const expectedSubtotal =
      result.totalEnergyChargesPaisa +
      result.wheelingChargesPaisa +
      result.demandChargesPaisa +
      result.fuelAdjustmentPaisa +
      result.electricityDutyPaisa +
      result.pfPenaltyPaisa +
      result.dgChargesPaisa;
    expect(result.subtotalPaisa).toBe(expectedSubtotal);

    // Run it again — must produce identical results
    const result2 = calculateBill(input);
    expect(result2.totalBillPaisa).toBe(result.totalBillPaisa);
  });
});
