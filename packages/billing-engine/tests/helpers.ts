import type { ClassifiedReading, TariffConfig } from '../src/types.js';
import { calculateSlotRate } from '../src/tod.js';

/**
 * Generate ClassifiedReading[] from a total kWh + percentage breakdown + tariff.
 * Bridges the percentage-based demo scenarios to the per-reading production API.
 *
 * Creates one reading per slot type based on the percentage distribution.
 */
export function generateReadingsFromPattern(
  totalKWh: number,
  pattern: { peakPercent: number; normalPercent: number; offPeakPercent: number },
  tariff: TariffConfig,
  baseTimestamp = '2026-02-15T00:00:00.000Z',
): ClassifiedReading[] {
  const readings: ClassifiedReading[] = [];

  const peakKWh = totalKWh * pattern.peakPercent / 100;
  const normalKWh = totalKWh * pattern.normalPercent / 100;
  const offPeakKWh = totalKWh * pattern.offPeakPercent / 100;

  // Find representative slots for each type
  const peakSlots = tariff.timeSlots.filter(s => s.type === 'peak');
  const normalSlots = tariff.timeSlots.filter(s => s.type === 'normal');
  const offPeakSlots = tariff.timeSlots.filter(s => s.type === 'off-peak');

  // Distribute energy evenly across slots of each type
  if (peakKWh > 0 && peakSlots.length > 0) {
    const kWhPerSlot = peakKWh / peakSlots.length;
    for (const slot of peakSlots) {
      readings.push({
        timestamp: baseTimestamp,
        kWh: kWhPerSlot,
        slotName: slot.name,
        slotType: 'peak',
        ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, slot),
      });
    }
  }

  if (normalKWh > 0 && normalSlots.length > 0) {
    const kWhPerSlot = normalKWh / normalSlots.length;
    for (const slot of normalSlots) {
      readings.push({
        timestamp: baseTimestamp,
        kWh: kWhPerSlot,
        slotName: slot.name,
        slotType: 'normal',
        ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, slot),
      });
    }
  }

  if (offPeakKWh > 0 && offPeakSlots.length > 0) {
    const kWhPerSlot = offPeakKWh / offPeakSlots.length;
    for (const slot of offPeakSlots) {
      readings.push({
        timestamp: baseTimestamp,
        kWh: kWhPerSlot,
        slotName: slot.name,
        slotType: 'off-peak',
        ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, slot),
      });
    }
  }

  return readings;
}

/**
 * Generate readings where all consumption is in a single slot type.
 * Useful for testing extreme scenarios (100% peak, 100% off-peak).
 */
export function generateUniformReadings(
  totalKWh: number,
  slotType: 'peak' | 'normal' | 'off-peak',
  tariff: TariffConfig,
  baseTimestamp = '2026-02-15T00:00:00.000Z',
): ClassifiedReading[] {
  const slots = tariff.timeSlots.filter(s => s.type === slotType);
  if (slots.length === 0) {
    // Fallback to first slot if no matching type
    const slot = tariff.timeSlots[0];
    return [{
      timestamp: baseTimestamp,
      kWh: totalKWh,
      slotName: slot.name,
      slotType: slot.type,
      ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, slot),
    }];
  }

  const kWhPerSlot = totalKWh / slots.length;
  return slots.map(slot => ({
    timestamp: baseTimestamp,
    kWh: kWhPerSlot,
    slotName: slot.name,
    slotType,
    ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, slot),
  }));
}
