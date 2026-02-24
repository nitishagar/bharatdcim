import { describe, it, expect } from 'vitest';
import { classifyReading } from '../../src/tod.js';
import { maharashtraTariff, tamilNaduTariff, karnatakaTariff, telanganaTariff } from '../../src/fixtures/tariffs.js';

// Helper to create a Date at a specific IST hour:minute
// Note: We use setHours directly since tests run with local system time.
// The classifyReading function uses getHours() which returns local time.
function makeTime(hour: number, minute = 0): Date {
  const d = new Date(2026, 1, 15); // Feb 15, 2026
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('ToD Classification', () => {
  describe('Maharashtra (MH)', () => {
    it('BE-T01: 03:00 → Night Off-Peak, 718 paisa', () => {
      const result = classifyReading(makeTime(3, 0), maharashtraTariff);
      expect(result.slotName).toBe('Night Off-Peak');
      expect(result.slotType).toBe('off-peak');
      expect(result.ratePaisa).toBe(718);
    });

    it('BE-T02: 07:30 → Morning Normal, 868 paisa', () => {
      const result = classifyReading(makeTime(7, 30), maharashtraTariff);
      expect(result.slotName).toBe('Morning Normal');
      expect(result.slotType).toBe('normal');
      expect(result.ratePaisa).toBe(868);
    });

    it('BE-T03: 10:00 → Morning Peak, 948 paisa', () => {
      const result = classifyReading(makeTime(10, 0), maharashtraTariff);
      expect(result.slotName).toBe('Morning Peak');
      expect(result.slotType).toBe('peak');
      expect(result.ratePaisa).toBe(948);
    });

    it('BE-T04: 15:00 → Solar Hours (Normal), 868 paisa', () => {
      const result = classifyReading(makeTime(15, 0), maharashtraTariff);
      expect(result.slotName).toBe('Solar Hours');
      expect(result.slotType).toBe('normal');
      expect(result.ratePaisa).toBe(868);
    });

    it('BE-T05: 20:00 → Evening Peak, 978 paisa', () => {
      const result = classifyReading(makeTime(20, 0), maharashtraTariff);
      expect(result.slotName).toBe('Evening Peak');
      expect(result.slotType).toBe('peak');
      expect(result.ratePaisa).toBe(978);
    });
  });

  describe('Tamil Nadu (TN)', () => {
    it('BE-T06: 07:00 → Morning Peak, 938 paisa', () => {
      const result = classifyReading(makeTime(7, 0), tamilNaduTariff);
      expect(result.slotName).toBe('Morning Peak');
      expect(result.slotType).toBe('peak');
      expect(result.ratePaisa).toBe(938);
    });

    it('BE-T07: 14:00 → Normal, 750 paisa', () => {
      const result = classifyReading(makeTime(14, 0), tamilNaduTariff);
      expect(result.slotName).toBe('Normal');
      expect(result.slotType).toBe('normal');
      expect(result.ratePaisa).toBe(750);
    });

    it('BE-T08: 23:00 → Night Off-Peak, 713 paisa', () => {
      const result = classifyReading(makeTime(23, 0), tamilNaduTariff);
      expect(result.slotName).toBe('Night Off-Peak');
      expect(result.slotType).toBe('off-peak');
      expect(result.ratePaisa).toBe(713);
    });
  });

  describe('Karnataka (KA)', () => {
    it('BE-T09: 19:00 → Evening Peak, 760 paisa', () => {
      const result = classifyReading(makeTime(19, 0), karnatakaTariff);
      expect(result.slotName).toBe('Evening Peak');
      expect(result.slotType).toBe('peak');
      expect(result.ratePaisa).toBe(760);
    });

    it('BE-T10: 01:00 → Night Off-Peak, 560 paisa', () => {
      const result = classifyReading(makeTime(1, 0), karnatakaTariff);
      expect(result.slotName).toBe('Night Off-Peak');
      expect(result.slotType).toBe('off-peak');
      expect(result.ratePaisa).toBe(560);
    });
  });

  describe('Telangana (TS)', () => {
    it('BE-T11: 08:00 → Morning Peak, 865 paisa', () => {
      const result = classifyReading(makeTime(8, 0), telanganaTariff);
      expect(result.slotName).toBe('Morning Peak');
      expect(result.slotType).toBe('peak');
      expect(result.ratePaisa).toBe(865);
    });

    it('BE-T12: 23:00 → Night (rebate suspended), 765 paisa', () => {
      const result = classifyReading(makeTime(23, 0), telanganaTariff);
      expect(result.slotName).toBe('Night');
      expect(result.slotType).toBe('normal');
      expect(result.ratePaisa).toBe(765);
    });
  });
});
