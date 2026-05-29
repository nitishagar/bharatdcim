import { describe, it, expect } from 'vitest';
import { test as fcTest, fc } from '@fast-check/vitest';
import Decimal from 'decimal.js';
import { calculateBill } from '../../src/calculate.js';
import { karnatakaTariff } from '../../src/fixtures/tariffs.js';
import type { BillCalculationInput, TariffConfig } from '../../src/types.js';

// A simple kWh-billed tariff for deterministic OA math
const oaTariff: TariffConfig = {
  ...karnatakaTariff,
  openAccess: {
    cssRatePaisa: 150,             // ₹1.50/unit — representative SERC CSS
    additionalSurchargePaisa: 50,  // ₹0.50/unit — representative AS (contested; many SERCs = 0)
    transmissionLossBps: 1000,     // 10% — combined transmission + wheeling loss gross-up
  },
};

// Minimal valid readings for 1000 kWh at normal rate
function make1000kWhGridReadings() {
  const slot = karnatakaTariff.timeSlots.find(s => s.type === 'normal')!;
  return [{ timestamp: '2026-02-15T08:00:00Z', kWh: 1000, slotName: slot.name, slotType: 'normal' as const, ratePaisa: slot.adderPaisa + karnatakaTariff.baseEnergyRatePaisa }];
}

const baseInput: BillCalculationInput = {
  readings: make1000kWhGridReadings(),
  tariff: oaTariff,
  contractedDemandKVA: 500,
  recordedDemandKVA: 450,
  powerFactor: 0.95,
  dgKWh: 0,
  dgRatePaisa: 0,
};

describe('Open Access billing', () => {
  it('OA-01: grid-only powerSources — ppaEnergyChargesPaisa = 0, energy unchanged', () => {
    const withoutOA = calculateBill(baseInput);
    const withGridSources = calculateBill({
      ...baseInput,
      powerSources: [{ source: 'grid', kWh: 1000 }],
    });

    // Grid entry in powerSources must not add PPA charges
    expect(withGridSources.ppaEnergyChargesPaisa).toBe(0);
    expect(withGridSources.crossSubsidySurchargePaisa).toBe(0);
    expect(withGridSources.additionalSurchargePaisa).toBe(0);
    expect(withGridSources.transmissionLossChargesPaisa).toBe(0);

    // Grid energy charges unchanged
    expect(withGridSources.totalEnergyChargesPaisa).toBe(withoutOA.totalEnergyChargesPaisa);
    expect(withGridSources.subtotalPaisa).toBe(withoutOA.subtotalPaisa);
    expect(withGridSources.totalBillPaisa).toBe(withoutOA.totalBillPaisa);
  });

  it('OA-02: solar PPA 1000 kWh at 400 paisa → ppaEnergyChargesPaisa = 400000', () => {
    const result = calculateBill({
      ...baseInput,
      readings: [], // no grid readings — all solar
      powerSources: [{ source: 'solar', kWh: 1000, ppaRatePaisa: 400 }],
    });

    expect(result.ppaEnergyChargesPaisa).toBe(400000);
    expect(result.sourceBreakdown).toHaveLength(1);
    expect(result.sourceBreakdown[0]).toEqual({ source: 'solar', kWh: 1000, energyChargesPaisa: 400000 });
  });

  it('OA-03: PPA energy included in subtotal and GST applied', () => {
    const result = calculateBill({
      ...baseInput,
      readings: [],
      powerSources: [{ source: 'solar', kWh: 1000, ppaRatePaisa: 400 }],
    });

    // subtotal must include ppaEnergyChargesPaisa
    expect(result.subtotalPaisa).toBeGreaterThan(result.ppaEnergyChargesPaisa);
    const expectedSubtotal =
      result.totalEnergyChargesPaisa + result.ppaEnergyChargesPaisa +
      result.wheelingChargesPaisa + result.demandChargesPaisa +
      result.fuelAdjustmentPaisa + result.electricityDutyPaisa +
      result.pfPenaltyPaisa + result.dgChargesPaisa +
      result.crossSubsidySurchargePaisa + result.additionalSurchargePaisa +
      result.transmissionLossChargesPaisa;
    expect(result.subtotalPaisa).toBe(expectedSubtotal);
    expect(result.gstPaisa).toBe(
      Math.round(new Decimal(result.subtotalPaisa).mul(oaTariff.gstRateBps).div(10000).toNumber()),
    );
  });

  it('OA-04: CSS = OA kWh × cssRatePaisa = 1000 × 150 = 150000', () => {
    const result = calculateBill({
      ...baseInput,
      readings: [],
      powerSources: [{ source: 'solar', kWh: 1000, ppaRatePaisa: 400 }],
    });

    expect(result.crossSubsidySurchargePaisa).toBe(150000);
  });

  it('OA-05: Additional Surcharge = OA kWh × additionalSurchargePaisa = 1000 × 50 = 50000', () => {
    const result = calculateBill({
      ...baseInput,
      readings: [],
      powerSources: [{ source: 'solar', kWh: 1000, ppaRatePaisa: 400 }],
    });

    expect(result.additionalSurchargePaisa).toBe(50000);
  });

  it('OA-06: Transmission loss = ppaEnergyChargesPaisa × transmissionLossBps / 10000 (10% of 400000 = 40000)', () => {
    // Modeled as % of OA energy charge — simplification; documented here and in calculate.ts
    const result = calculateBill({
      ...baseInput,
      readings: [],
      powerSources: [{ source: 'solar', kWh: 1000, ppaRatePaisa: 400 }],
    });

    const expected = Math.round(new Decimal(400000).mul(1000).div(10000).toNumber());
    expect(result.transmissionLossChargesPaisa).toBe(expected); // 40000
  });

  it('OA-07: mixed captive + solar accumulate oaKWh for CSS/AS', () => {
    const result = calculateBill({
      ...baseInput,
      readings: [],
      powerSources: [
        { source: 'solar', kWh: 600, ppaRatePaisa: 400 },
        { source: 'captive', kWh: 400, ppaRatePaisa: 350 },
      ],
    });

    // oaKWh = 1000
    expect(result.crossSubsidySurchargePaisa).toBe(1000 * 150); // 150000
    expect(result.additionalSurchargePaisa).toBe(1000 * 50);    // 50000

    // ppaEnergy = 600×400 + 400×350 = 240000 + 140000 = 380000
    expect(result.ppaEnergyChargesPaisa).toBe(380000);
    expect(result.sourceBreakdown).toHaveLength(2);
  });

  it('OA-08: OA charges zero when powerSources absent (Phase-1 invariant re-assertion)', () => {
    const result = calculateBill(baseInput);

    expect(result.ppaEnergyChargesPaisa).toBe(0);
    expect(result.crossSubsidySurchargePaisa).toBe(0);
    expect(result.additionalSurchargePaisa).toBe(0);
    expect(result.transmissionLossChargesPaisa).toBe(0);
    expect(result.sourceBreakdown).toHaveLength(0);
  });

  fcTest.prop([
    fc.integer({ min: 100, max: 100000 }),
    fc.integer({ min: 100, max: 1000 }),  // ppaRatePaisa
  ])('OA-P01: property — subtotal completeness with OA inputs', (oaKWh, ppaRatePaisa) => {
    const result = calculateBill({
      ...baseInput,
      readings: [],
      powerSources: [{ source: 'solar', kWh: oaKWh, ppaRatePaisa }],
    });

    const expectedSubtotal =
      result.totalEnergyChargesPaisa +
      result.ppaEnergyChargesPaisa +
      result.wheelingChargesPaisa +
      result.demandChargesPaisa +
      result.fuelAdjustmentPaisa +
      result.electricityDutyPaisa +
      result.pfPenaltyPaisa +
      result.dgChargesPaisa +
      result.crossSubsidySurchargePaisa +
      result.additionalSurchargePaisa +
      result.transmissionLossChargesPaisa;

    expect(result.subtotalPaisa).toBe(expectedSubtotal);
    expect(result.totalBillPaisa).toBe(result.subtotalPaisa + result.gstPaisa);
  });
});
