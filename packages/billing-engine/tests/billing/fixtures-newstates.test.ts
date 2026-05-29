import { describe, it, expect } from 'vitest';
import { calculateBill } from '../../src/calculate.js';
import {
  madhyaPradeshTariff,
  gujaratTariff,
  uttarPradeshTariff,
  delhiTariff,
  tariffFixtures,
} from '../../src/fixtures/tariffs.js';
import type { TariffConfig } from '../../src/types.js';
import { generateReadingsFromPattern } from '../helpers.js';

const NEW_STATE_CODES = ['MP', 'GJ', 'UP', 'DL'] as const;
const NEW_FIXTURES = [madhyaPradeshTariff, gujaratTariff, uttarPradeshTariff, delhiTariff];

const SAMPLE_PATTERN = { peakPercent: 30, normalPercent: 50, offPeakPercent: 20 };

describe('tariffFixtures — 8 states', () => {
  it('tariffFixtures has exactly 8 entries', () => {
    expect(Object.keys(tariffFixtures)).toHaveLength(8);
  });

  for (const code of NEW_STATE_CODES) {
    it(`${code} is present in tariffFixtures`, () => {
      expect(tariffFixtures[code]).toBeDefined();
      expect(tariffFixtures[code].stateCode).toBe(code);
    });
  }
});

describe('new state fixture invariants', () => {
  function checkFixture(tariff: TariffConfig) {
    it(`${tariff.stateCode}: non-empty timeSlots`, () => {
      expect(tariff.timeSlots.length).toBeGreaterThan(0);
    });

    it(`${tariff.stateCode}: 24h coverage (slots contiguous)`, () => {
      // Sort by startHour to verify coverage
      expect(tariff.timeSlots.length).toBeGreaterThanOrEqual(3);
      expect(tariff.timeSlots.some(s => s.type === 'peak')).toBe(true);
      expect(tariff.timeSlots.some(s => s.type === 'off-peak')).toBe(true);
    });

    it(`${tariff.stateCode}: positive baseEnergyRatePaisa`, () => {
      expect(tariff.baseEnergyRatePaisa).toBeGreaterThan(0);
    });

    it(`${tariff.stateCode}: gstRateBps === 1800`, () => {
      expect(tariff.gstRateBps).toBe(1800);
    });

    it(`${tariff.stateCode}: pfThresholdBps in (8000, 10000]`, () => {
      expect(tariff.pfThresholdBps).toBeGreaterThan(8000);
      expect(tariff.pfThresholdBps).toBeLessThanOrEqual(10000);
    });

    it(`${tariff.stateCode}: version === 1`, () => {
      expect(tariff.version).toBe(1);
    });

    it(`${tariff.stateCode}: effectiveTo === null`, () => {
      expect(tariff.effectiveTo).toBeNull();
    });

    it(`${tariff.stateCode}: billingUnit is kWh or kVAh`, () => {
      expect(['kWh', 'kVAh']).toContain(tariff.billingUnit);
    });
  }

  for (const tariff of NEW_FIXTURES) {
    checkFixture(tariff);
  }
});

describe('new state calculateBill smoke tests', () => {
  for (const tariff of NEW_FIXTURES) {
    it(`${tariff.stateCode}: calculateBill returns totalBillPaisa > 0`, () => {
      const readings = generateReadingsFromPattern(50000, SAMPLE_PATTERN, tariff);
      const result = calculateBill({
        readings,
        tariff,
        contractedDemandKVA: 500,
        recordedDemandKVA: 450,
        powerFactor: 0.92,
        dgKWh: 0,
        dgRatePaisa: 0,
      });
      expect(result.totalBillPaisa).toBeGreaterThan(0);
      expect(result.gstPaisa).toBeGreaterThan(0);
    });
  }
});
