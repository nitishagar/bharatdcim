import { z } from 'zod';

export const CreateRecSchema = z.object({
  id: z.string().min(1),
  certificateType: z.enum(['REC', 'I-REC']),
  serialNumber: z.string().min(1),
  source: z.enum(['solar', 'wind', 'hydro', 'other']),
  mwh: z.number().int().positive(),
  vintagePeriodStart: z.string().min(1),
  vintagePeriodEnd: z.string().min(1),
});

export const RetireRecSchema = z.object({
  retiredAgainstPeriod: z.string().optional(),
});

export const ComputeEmissionsSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  gridEmissionFactorGPerKwh: z.number().int().min(1).optional().default(710),
});
