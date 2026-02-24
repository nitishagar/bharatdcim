import { describe, it, expect } from 'vitest';
import { classifyReading } from '../../src/tod.js';
import { maharashtraTariff, karnatakaTariff } from '../../src/fixtures/tariffs.js';

// Helper to create a Date at a specific hour:minute (local time matches UTC for consistency)
function makeTime(hour: number, minute: number): Date {
  return new Date(2025, 1, 15, hour, minute, 0);
}

describe('ToD Classification from CSV Timestamps', () => {
  // CSV-030: 20:00 MH grid → peak (evening peak slot: 18:00-22:00)
  // MH Evening Peak adder = +110 → 868 + 110 = 978 paisa
  it('CSV-030: 20:00 MH grid → peak, 978 paisa', () => {
    const result = classifyReading(makeTime(20, 0), maharashtraTariff);
    expect(result.slotType).toBe('peak');
    expect(result.ratePaisa).toBe(978);
  });

  // CSV-031: 02:00 MH grid → off-peak (night off-peak slot: 22:00-06:00)
  // MH Night Off-Peak adder = -150 → 868 - 150 = 718 paisa
  it('CSV-031: 02:00 MH grid → off-peak, 718 paisa', () => {
    const result = classifyReading(makeTime(2, 0), maharashtraTariff);
    expect(result.slotType).toBe('off-peak');
    expect(result.ratePaisa).toBe(718);
  });

  // CSV-032: 20:00 MH DG → DG rate, not subject to ToD classification
  // (DG classification is handled at the bill level, not per reading)
  it('CSV-032: DG readings use DG rate at bill calculation level', () => {
    // ToD classification still applies to the reading timestamp
    // DG vs grid distinction is at the calculateBill level via dgKWh/dgRatePaisa
    const result = classifyReading(makeTime(20, 0), maharashtraTariff);
    expect(result.slotType).toBe('peak'); // Timestamp is classified regardless
  });

  // CSV-033: 22:00 KA grid → off-peak (KA Night Off-Peak: 22:00-06:00, [start, end) convention)
  it('CSV-033: 22:00 KA grid → off-peak (start of slot)', () => {
    const result = classifyReading(makeTime(22, 0), karnatakaTariff);
    expect(result.slotType).toBe('off-peak');
  });

  // CSV-034: 21:59 KA grid → peak (still in Evening Peak: 18:00-22:00)
  it('CSV-034: 21:59 KA grid → peak (still in peak)', () => {
    const result = classifyReading(makeTime(21, 59), karnatakaTariff);
    expect(result.slotType).toBe('peak');
  });
});
