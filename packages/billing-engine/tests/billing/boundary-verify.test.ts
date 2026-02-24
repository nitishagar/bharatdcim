import { describe, it, expect } from 'vitest';
import { classifyReading } from '../../src/tod.js';
import { maharashtraTariff, tamilNaduTariff, karnatakaTariff, telanganaTariff } from '../../src/fixtures/tariffs.js';

function makeTime(hour: number, minute = 0): Date {
  const d = new Date(2026, 1, 15);
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('ToD Boundary Verification (exact transition points)', () => {
  describe('22:00 boundary — MH Evening Peak → Night Off-Peak', () => {
    it('21:59 → Evening Peak (978p)', () => {
      const r = classifyReading(makeTime(21, 59), maharashtraTariff);
      expect(r.slotName).toBe('Evening Peak');
      expect(r.slotType).toBe('peak');
      expect(r.ratePaisa).toBe(978);
    });
    it('22:00 → Night Off-Peak (718p)', () => {
      const r = classifyReading(makeTime(22, 0), maharashtraTariff);
      expect(r.slotName).toBe('Night Off-Peak');
      expect(r.slotType).toBe('off-peak');
      expect(r.ratePaisa).toBe(718);
    });
  });

  describe('06:00 boundary — Night → Morning', () => {
    it('MH 05:59 → Night Off-Peak', () => {
      const r = classifyReading(makeTime(5, 59), maharashtraTariff);
      expect(r.slotName).toBe('Night Off-Peak');
    });
    it('MH 06:00 → Morning Normal', () => {
      const r = classifyReading(makeTime(6, 0), maharashtraTariff);
      expect(r.slotName).toBe('Morning Normal');
    });
    it('TN 04:59 → Night Off-Peak', () => {
      const r = classifyReading(makeTime(4, 59), tamilNaduTariff);
      expect(r.slotName).toBe('Night Off-Peak');
    });
    it('TN 05:00 → Early Morning', () => {
      const r = classifyReading(makeTime(5, 0), tamilNaduTariff);
      expect(r.slotName).toBe('Early Morning');
    });
  });

  describe('18:00 boundary — Day → Evening Peak', () => {
    it('KA 17:59 → Day Normal', () => {
      const r = classifyReading(makeTime(17, 59), karnatakaTariff);
      expect(r.slotName).toBe('Day Normal');
    });
    it('KA 18:00 → Evening Peak', () => {
      const r = classifyReading(makeTime(18, 0), karnatakaTariff);
      expect(r.slotName).toBe('Evening Peak');
    });
  });

  describe('Full 24h coverage — every hour classified', () => {
    it('MH: all 24 hours have valid classifications', () => {
      for (let h = 0; h < 24; h++) {
        const r = classifyReading(makeTime(h), maharashtraTariff);
        expect(r.slotName).not.toBe('Unknown');
        expect(r.ratePaisa).toBeGreaterThan(0);
      }
    });
    it('TN: all 24 hours have valid classifications', () => {
      for (let h = 0; h < 24; h++) {
        const r = classifyReading(makeTime(h), tamilNaduTariff);
        expect(r.slotName).not.toBe('Unknown');
        expect(r.ratePaisa).toBeGreaterThan(0);
      }
    });
    it('KA: all 24 hours have valid classifications', () => {
      for (let h = 0; h < 24; h++) {
        const r = classifyReading(makeTime(h), karnatakaTariff);
        expect(r.slotName).not.toBe('Unknown');
        expect(r.ratePaisa).toBeGreaterThan(0);
      }
    });
    it('TS: all 24 hours have valid classifications', () => {
      for (let h = 0; h < 24; h++) {
        const r = classifyReading(makeTime(h), telanganaTariff);
        expect(r.slotName).not.toBe('Unknown');
        expect(r.ratePaisa).toBeGreaterThan(0);
      }
    });
  });
});
