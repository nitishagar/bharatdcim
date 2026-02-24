import Decimal from 'decimal.js';
import type { TariffConfig, TimeSlotConfig, SlotClassification, ClassifiedReading } from './types.js';

/**
 * Convert a time slot's hour:minute to total minutes from midnight.
 */
function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * Calculate the effective rate for a time slot in paisa.
 * Formula: Math.round((baseRate * multiplierBps / 10000) + adderPaisa)
 */
export function calculateSlotRate(baseRatePaisa: number, slot: TimeSlotConfig): number {
  return Math.round((baseRatePaisa * slot.multiplierBps) / 10000 + slot.adderPaisa);
}

/**
 * Check if a given time (in minutes from midnight) falls within a slot.
 * Handles overnight slots (e.g., 22:00 → 06:00) with wrap-around logic.
 */
function isTimeInSlot(timeMinutes: number, slot: TimeSlotConfig): boolean {
  const slotStart = toMinutes(slot.startHour, slot.startMinute);
  const slotEnd = toMinutes(slot.endHour, slot.endMinute);

  if (slotStart < slotEnd) {
    // Normal slot (e.g., 09:00-12:00)
    return timeMinutes >= slotStart && timeMinutes < slotEnd;
  } else {
    // Overnight slot (e.g., 22:00-06:00)
    return timeMinutes >= slotStart || timeMinutes < slotEnd;
  }
}

/**
 * Classify a single timestamp into its ToD slot.
 * Returns the slot name, type, and effective rate in paisa.
 */
export function classifyReading(timestamp: Date, tariff: TariffConfig): SlotClassification {
  const hour = timestamp.getHours();
  const minute = timestamp.getMinutes();
  const timeMinutes = toMinutes(hour, minute);

  for (const slot of tariff.timeSlots) {
    if (isTimeInSlot(timeMinutes, slot)) {
      return {
        slotName: slot.name,
        slotType: slot.type,
        ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, slot),
      };
    }
  }

  // Fallback: should never reach here if tariff slots cover 24 hours
  return {
    slotName: 'Unknown',
    slotType: 'normal',
    ratePaisa: tariff.baseEnergyRatePaisa,
  };
}

/**
 * Find all slot boundaries between startTime and endTime.
 * Returns an array of { time, slot } pairs, sorted chronologically.
 */
function findSlotTransitions(
  startTime: Date,
  endTime: Date,
  tariff: TariffConfig,
): Array<{ minuteOfDay: number; slot: TimeSlotConfig }> {
  const transitions: Array<{ minuteOfDay: number; slot: TimeSlotConfig }> = [];

  for (const slot of tariff.timeSlots) {
    const slotStartMinute = toMinutes(slot.startHour, slot.startMinute);
    transitions.push({ minuteOfDay: slotStartMinute, slot });
  }

  // Sort by minute of day
  transitions.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
  return transitions;
}

/**
 * Classify a reading interval with pro-rating at ToD boundaries.
 *
 * When a reading interval spans a slot change, energy is split
 * proportionally by minutes in each slot.
 *
 * Example: reading 21:50–22:05 (15 min), 22:00 is MH peak→off-peak boundary
 *   - 10 min in peak slot → 10/15 * kWh at peak rate
 *   - 5 min in off-peak slot → 5/15 * kWh at off-peak rate
 */
export function classifyReadingWithProRating(
  startTime: Date,
  endTime: Date,
  kWh: number,
  tariff: TariffConfig,
): ClassifiedReading[] {
  const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

  if (totalMinutes <= 0) {
    return [];
  }

  // Build list of segments: each segment is a continuous time within one slot
  const segments: Array<{
    startMinute: number; // offset from startTime in minutes
    endMinute: number;
    slot: TimeSlotConfig;
  }> = [];

  let currentTime = new Date(startTime.getTime());

  while (currentTime < endTime) {
    // Find which slot this moment falls in
    const classification = classifyReading(currentTime, tariff);
    const matchingSlot = tariff.timeSlots.find(
      (s) => calculateSlotRate(tariff.baseEnergyRatePaisa, s) === classification.ratePaisa
        && s.type === classification.slotType
        && s.name === classification.slotName,
    )!;

    const offsetMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);

    // Find the end of this slot (next boundary)
    let nextBoundary = new Date(endTime.getTime());

    // Check all slot start times to find the next boundary
    for (const slot of tariff.timeSlots) {
      const boundaryDate = new Date(currentTime.getTime());
      boundaryDate.setHours(slot.startHour, slot.startMinute, 0, 0);

      // If boundary is at or before current time, move to next day
      if (boundaryDate <= currentTime) {
        boundaryDate.setDate(boundaryDate.getDate() + 1);
      }

      if (boundaryDate < nextBoundary && boundaryDate > currentTime) {
        nextBoundary = boundaryDate;
      }
    }

    // Clamp to endTime
    if (nextBoundary > endTime) {
      nextBoundary = new Date(endTime.getTime());
    }

    const endOffsetMinutes = (nextBoundary.getTime() - startTime.getTime()) / (1000 * 60);

    segments.push({
      startMinute: offsetMinutes,
      endMinute: endOffsetMinutes,
      slot: matchingSlot,
    });

    currentTime = nextBoundary;
  }

  // Convert segments to classified readings with pro-rated energy
  const results: ClassifiedReading[] = [];
  const totalMinutesDecimal = new Decimal(totalMinutes);

  for (const segment of segments) {
    const segmentMinutes = segment.endMinute - segment.startMinute;
    if (segmentMinutes <= 0) continue;

    const segmentKWh = new Decimal(segmentMinutes)
      .div(totalMinutesDecimal)
      .mul(kWh)
      .toNumber();

    // Round to reasonable precision (3 decimal places for kWh)
    const roundedKWh = Math.round(segmentKWh * 1000) / 1000;

    if (roundedKWh > 0) {
      const segmentStart = new Date(startTime.getTime() + segment.startMinute * 60 * 1000);
      results.push({
        timestamp: segmentStart.toISOString(),
        kWh: roundedKWh,
        slotName: segment.slot.name,
        slotType: segment.slot.type,
        ratePaisa: calculateSlotRate(tariff.baseEnergyRatePaisa, segment.slot),
      });
    }
  }

  return results;
}
