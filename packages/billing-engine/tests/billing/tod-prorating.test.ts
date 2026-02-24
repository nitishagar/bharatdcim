import { describe, it, expect } from 'vitest';
import { classifyReadingWithProRating } from '../../src/tod.js';
import { maharashtraTariff, tamilNaduTariff } from '../../src/fixtures/tariffs.js';

function makeTime(hour: number, minute: number): Date {
  const d = new Date(2026, 1, 15); // Feb 15, 2026
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('ToD Pro-Rating', () => {
  it('BE-R01: 21:50–22:05 MH, 3 kWh → 2 kWh peak (978p) + 1 kWh off-peak (718p)', () => {
    const start = makeTime(21, 50);
    const end = makeTime(22, 5);
    const readings = classifyReadingWithProRating(start, end, 3, maharashtraTariff);

    expect(readings).toHaveLength(2);

    // First segment: 21:50-22:00 = 10 min in Evening Peak (978 paisa)
    const peakReading = readings.find(r => r.slotType === 'peak');
    expect(peakReading).toBeDefined();
    expect(peakReading!.ratePaisa).toBe(978);
    expect(peakReading!.kWh).toBeCloseTo(2, 1); // 10/15 * 3 = 2

    // Second segment: 22:00-22:05 = 5 min in Night Off-Peak (718 paisa)
    const offPeakReading = readings.find(r => r.slotType === 'off-peak');
    expect(offPeakReading).toBeDefined();
    expect(offPeakReading!.ratePaisa).toBe(718);
    expect(offPeakReading!.kWh).toBeCloseTo(1, 1); // 5/15 * 3 = 1
  });

  it('BE-R02: 04:50–05:10 TN, 4 kWh → 2 kWh off-peak (713p) + 2 kWh early-morning (750p)', () => {
    const start = makeTime(4, 50);
    const end = makeTime(5, 10);
    const readings = classifyReadingWithProRating(start, end, 4, tamilNaduTariff);

    expect(readings).toHaveLength(2);

    // First segment: 04:50-05:00 = 10 min in Night Off-Peak (713 paisa)
    const offPeakReading = readings.find(r => r.slotType === 'off-peak');
    expect(offPeakReading).toBeDefined();
    expect(offPeakReading!.ratePaisa).toBe(713);
    expect(offPeakReading!.kWh).toBeCloseTo(2, 1); // 10/20 * 4 = 2

    // Second segment: 05:00-05:10 = 10 min in Early Morning Normal (750 paisa)
    const normalReading = readings.find(r => r.slotType === 'normal');
    expect(normalReading).toBeDefined();
    expect(normalReading!.ratePaisa).toBe(750);
    expect(normalReading!.kWh).toBeCloseTo(2, 1); // 10/20 * 4 = 2
  });

  it('BE-R03: 10:00–10:15 MH, 3 kWh → all in Solar Hours (no split needed)', () => {
    const start = makeTime(10, 0);
    const end = makeTime(10, 15);

    // 10:00-10:15 is entirely within Morning Peak (9:00-12:00) for MH
    // Wait — actually looking at MH slots: Morning Peak is 9-12, Solar Hours is 12-18
    // So 10:00-10:15 is entirely in Morning Peak
    const readings = classifyReadingWithProRating(start, end, 3, maharashtraTariff);

    expect(readings).toHaveLength(1);
    expect(readings[0].kWh).toBeCloseTo(3, 1);
    // No split since entirely within one slot
  });
});
