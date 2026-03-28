import { describe, it, expect } from 'vitest';
import {
  computeSMA,
  fitLinearRegression,
  projectBreachDate,
  aggregateByDay,
} from '../../src/services/capacity-math.js';

describe('computeSMA', () => {
  it('returns correct SMA with window=3 for 5-element array', () => {
    const result = computeSMA([100, 200, 300, 400, 500], 3);
    expect(result).toEqual([null, null, 200, 300, 400]);
  });

  it('returns all nulls when array shorter than window', () => {
    const result = computeSMA([100, 200], 3);
    expect(result).toEqual([null, null]);
  });

  it('handles window=1 (each element is its own average)', () => {
    const result = computeSMA([100], 1);
    expect(result).toEqual([100]);
  });

  it('returns empty array for empty input', () => {
    expect(computeSMA([], 3)).toEqual([]);
  });

  it('returns null for first two, average for third with exactly 3 elements', () => {
    const result = computeSMA([100, 200, 300], 3);
    expect(result).toEqual([null, null, 200]);
  });
});

describe('fitLinearRegression', () => {
  it('returns exact slope and intercept for perfectly linear data', () => {
    const result = fitLinearRegression([
      { x: 0, y: 100 },
      { x: 1, y: 150 },
      { x: 2, y: 200 },
    ]);
    expect(result.slope).toBeCloseTo(50, 5);
    expect(result.intercept).toBeCloseTo(100, 5);
    expect(result.r2).toBeCloseTo(1.0, 5);
  });

  it('returns slope=0 for flat data', () => {
    const result = fitLinearRegression([
      { x: 0, y: 100 },
      { x: 1, y: 100 },
    ]);
    expect(result.slope).toBeCloseTo(0, 5);
    expect(result.intercept).toBeCloseTo(100, 5);
    expect(result.r2).toBeCloseTo(1.0, 5);
  });

  it('returns slope=0 and intercept=y for single point', () => {
    const result = fitLinearRegression([{ x: 0, y: 0 }]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.r2).toBe(1);
  });

  it('returns all zeros for empty array', () => {
    const result = fitLinearRegression([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.r2).toBe(0);
  });

  it('returns r2 between 0 and 1 for noisy data', () => {
    const result = fitLinearRegression([
      { x: 0, y: 100 },
      { x: 1, y: 180 },
      { x: 2, y: 160 },
    ]);
    expect(result.r2).toBeGreaterThan(0);
    expect(result.r2).toBeLessThan(1);
  });
});

describe('projectBreachDate', () => {
  it('returns correct breach date for growing trend', () => {
    // slope=50, intercept=100 → day 4: 50*4+100=300 = threshold
    const result = projectBreachDate({ slope: 50, intercept: 100 }, 300, '2026-01-01');
    expect(result).toBe('2026-01-05');
  });

  it('returns null for flat trend (slope=0)', () => {
    const result = projectBreachDate({ slope: 0, intercept: 100 }, 300, '2026-01-01');
    expect(result).toBeNull();
  });

  it('returns null for declining trend (slope<0) with upper-bound threshold', () => {
    // Declining from 200 — will never reach upper threshold 300
    const result = projectBreachDate({ slope: -10, intercept: 200 }, 300, '2026-01-01');
    expect(result).toBeNull();
  });

  it('returns null when already at or above threshold at day 0', () => {
    // intercept=50, threshold=50: already at threshold, fractional days <=0
    const result = projectBreachDate({ slope: 10, intercept: 50 }, 50, '2026-01-01');
    expect(result).toBeNull();
  });

  it('returns null when breach is more than 365 days away', () => {
    // slope=1, intercept=0 → breach at day 10000: (10000 - 0) / 1 = 10000 > 365
    const result = projectBreachDate({ slope: 1, intercept: 0 }, 10000, '2026-01-01');
    expect(result).toBeNull();
  });

  it('correctly handles fractional breach days by ceiling', () => {
    // slope=100, intercept=0 → threshold=150 → day=1.5 → ceil=2 → '2026-01-03'
    const result = projectBreachDate({ slope: 100, intercept: 0 }, 150, '2026-01-01');
    expect(result).toBe('2026-01-03');
  });
});

describe('aggregateByDay', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateByDay([])).toEqual([]);
  });

  it('groups readings into UTC calendar days', () => {
    const readings = [
      { timestamp: '2026-01-01T00:00:00.000Z', kWh: 100000, kW: 10000 },
      { timestamp: '2026-01-01T12:00:00.000Z', kWh: 200000, kW: 20000 },
      { timestamp: '2026-01-02T00:00:00.000Z', kWh: 150000, kW: 15000 },
    ];
    const result = aggregateByDay(readings);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-01-01');
    expect(result[1].date).toBe('2026-01-02');
  });

  it('sums kWh within the same day', () => {
    const readings = [
      { timestamp: '2026-01-01T00:00:00.000Z', kWh: 100000, kW: 10000 },
      { timestamp: '2026-01-01T06:00:00.000Z', kWh: 200000, kW: 5000 },
    ];
    const result = aggregateByDay(readings);
    // kWh stored as ×1000, so 100000 + 200000 = 300000 → 300 kWh
    expect(result[0].totalKwh).toBeCloseTo(300, 2);
  });

  it('returns correct peakKw from the highest kW reading in a day', () => {
    const readings = [
      { timestamp: '2026-01-01T00:00:00.000Z', kWh: 100000, kW: 10000 },
      { timestamp: '2026-01-01T06:00:00.000Z', kWh: 50000, kW: 25000 },
      { timestamp: '2026-01-01T12:00:00.000Z', kWh: 80000, kW: 5000 },
    ];
    const result = aggregateByDay(readings);
    // kW stored as ×1000, so peak = 25000 / 1000 = 25 kW
    expect(result[0].peakKw).toBeCloseTo(25, 2);
  });

  it('handles null kWh and kW values (treats as 0)', () => {
    const readings = [
      { timestamp: '2026-01-01T00:00:00.000Z', kWh: null, kW: null },
    ];
    const result = aggregateByDay(readings);
    expect(result[0].totalKwh).toBe(0);
    expect(result[0].peakKw).toBe(0);
  });

  it('returns results sorted by date ascending', () => {
    const readings = [
      { timestamp: '2026-01-03T00:00:00.000Z', kWh: 100000, kW: 10000 },
      { timestamp: '2026-01-01T00:00:00.000Z', kWh: 100000, kW: 10000 },
      { timestamp: '2026-01-02T00:00:00.000Z', kWh: 100000, kW: 10000 },
    ];
    const result = aggregateByDay(readings);
    expect(result.map(r => r.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
});
