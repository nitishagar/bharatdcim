export interface Point {
  x: number;
  y: number;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

export interface DailyAggregate {
  date: string;
  totalKwh: number;
  peakKw: number;
}

export interface ReadingRow {
  timestamp: string;
  kWh: number | null;
  kW: number | null;
}

/**
 * Compute Simple Moving Average over an array of values.
 * Returns null for positions with insufficient history (i < window - 1).
 */
export function computeSMA(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

/**
 * Ordinary Least Squares linear regression.
 * Returns slope, intercept (y = slope*x + intercept), and R² goodness-of-fit.
 */
export function fitLinearRegression(points: Point[]): RegressionResult {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y, r2: 1 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n, r2: 1 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

/**
 * Given a linear trend and an upper threshold (max allowed value),
 * returns the projected breach date (ISO date string) or null.
 *
 * Breach occurs when the metric EXCEEDS the threshold (upper bound).
 * Returns null if: slope <= 0, already breached at day 0, or breach > 365 days away.
 */
export function projectBreachDate(
  regression: Pick<RegressionResult, 'slope' | 'intercept'>,
  threshold: number,
  startDate: string,
): string | null {
  const { slope, intercept } = regression;
  if (slope <= 0) return null;

  // Solve: slope * x + intercept = threshold → x = (threshold - intercept) / slope
  const daysToBreachFractional = (threshold - intercept) / slope;
  if (daysToBreachFractional <= 0) return null; // already at or above threshold
  const daysToBreachInt = Math.ceil(daysToBreachFractional);
  if (daysToBreachInt > 365) return null; // too far out to be actionable

  const breachDate = new Date(startDate);
  breachDate.setUTCDate(breachDate.getUTCDate() + daysToBreachInt);
  return breachDate.toISOString().split('T')[0];
}

/**
 * Aggregate reading rows into daily totals.
 * kWh stored as ×1000 integers in DB; converted back to kWh floats.
 * kW stored as ×1000 integers in DB; converted back to kW floats.
 * Results sorted by date ascending.
 */
export function aggregateByDay(readings: ReadingRow[]): DailyAggregate[] {
  const dayMap = new Map<string, { totalKwh: number; peakKw: number }>();

  for (const r of readings) {
    const date = r.timestamp.split('T')[0];
    const kWh = (r.kWh ?? 0) / 1000;
    const kW = (r.kW ?? 0) / 1000;
    const existing = dayMap.get(date) ?? { totalKwh: 0, peakKw: 0 };
    dayMap.set(date, {
      totalKwh: existing.totalKwh + kWh,
      peakKw: Math.max(existing.peakKw, kW),
    });
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { totalKwh, peakKw }]) => ({ date, totalKwh, peakKw }));
}
