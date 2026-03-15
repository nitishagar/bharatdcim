import { z } from 'zod';

export const CreateTariffSchema = z.object({
  id: z.string().min(1),
  stateCode: z.string().min(1).max(5),
  discom: z.string().optional().default(''),
  category: z.string().optional().default(''),
  baseEnergyRatePaisa: z.number().int().positive(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  billingUnit: z.enum(['kWh', 'kVAh']).optional().default('kWh'),
  wheelingChargePaisa: z.number().int().min(0).optional().default(0),
  demandChargePerKvaPaisa: z.number().int().min(0).optional().default(0),
  demandRatchetPercent: z.number().int().min(0).max(100).optional().default(100),
  minimumDemandKva: z.number().int().min(0).optional().default(0),
  timeSlots: z.array(z.object({
    name: z.string(),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
    ratePaisa: z.number().int().min(0),
  }).passthrough()).optional().default([]),
  timeSlotsJson: z.string().optional(),
  fuelAdjustmentPaisa: z.number().int().min(0).optional().default(0),
  fuelAdjustmentType: z.enum(['absolute', 'percentage']).optional().default('absolute'),
  electricityDutyBps: z.number().int().min(0).optional().default(0),
  pfThresholdBps: z.number().int().min(0).max(10000).optional().default(9000),
  pfPenaltyRatePaisa: z.number().int().min(0).optional().default(0),
  version: z.number().int().positive().optional().default(1),
});

export const UpdateTariffSchema = z.object({
  stateCode: z.string().min(1).max(5).optional(),
  discom: z.string().optional(),
  category: z.string().optional(),
  baseEnergyRatePaisa: z.number().int().positive().optional(),
  wheelingChargePaisa: z.number().int().min(0).optional(),
  demandChargePerKvaPaisa: z.number().int().min(0).optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullable().optional(),
  billingUnit: z.enum(['kWh', 'kVAh']).optional(),
});
