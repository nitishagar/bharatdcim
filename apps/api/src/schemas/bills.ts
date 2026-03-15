import { z } from 'zod';

/** Stateless bill calculation — readings + tariff in, charges out */
export const CalculateBillSchema = z.object({
  readings: z.array(z.object({
    kWh: z.number(),
    kW: z.number().optional(),
    slotType: z.enum(['peak', 'normal', 'off-peak']).optional(),
  }).passthrough()).min(1),
  tariff: z.object({
    baseEnergyRatePaisa: z.number().int(),
    wheelingChargePaisa: z.number().int().optional(),
    demandChargePerKvaPaisa: z.number().int().optional(),
    billingUnit: z.enum(['kWh', 'kVAh']).optional(),
  }).passthrough(), // Allow full tariff object fields
  contractedDemandKVA: z.number().min(0).optional().default(0),
  recordedDemandKVA: z.number().min(0).optional().default(0),
  powerFactor: z.number().min(0).max(1).optional().default(1.0),
  dgKWh: z.number().min(0).optional().default(0),
  dgRatePaisa: z.number().int().min(0).optional().default(0),
});

/** Store a pre-calculated bill */
export const CreateBillSchema = z.object({
  id: z.string().min(1),
  meterId: z.string().min(1),
  tariffId: z.string().min(1),
  billingPeriodStart: z.string().min(1),
  billingPeriodEnd: z.string().min(1),
  peakKwh: z.number().int(),
  normalKwh: z.number().int(),
  offPeakKwh: z.number().int(),
  totalKwh: z.number().int(),
  billedKvah: z.number().int().nullable().optional(),
  contractedDemandKva: z.number().int(),
  recordedDemandKva: z.number().int(),
  billedDemandKva: z.number().int(),
  powerFactor: z.number().int(), // BPS
  peakChargesPaisa: z.number().int(),
  normalChargesPaisa: z.number().int(),
  offPeakChargesPaisa: z.number().int(),
  totalEnergyChargesPaisa: z.number().int(),
  wheelingChargesPaisa: z.number().int(),
  demandChargesPaisa: z.number().int(),
  fuelAdjustmentPaisa: z.number().int(),
  electricityDutyPaisa: z.number().int(),
  pfPenaltyPaisa: z.number().int(),
  dgChargesPaisa: z.number().int(),
  subtotalPaisa: z.number().int(),
  gstPaisa: z.number().int(),
  totalBillPaisa: z.number().int(),
  effectiveRatePaisaPerKwh: z.number().int(),
  status: z.enum(['draft', 'invoiced']).optional().default('draft'),
});
