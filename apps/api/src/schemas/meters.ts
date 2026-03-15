import { z } from 'zod';

export const CreateMeterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  stateCode: z.string().min(1).max(5),
  siteId: z.string().optional(),
  tariffId: z.string().optional(),
  meterType: z.enum(['grid', 'dg', 'solar']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateMeterSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  stateCode: z.string().min(1).max(5).optional(),
  siteId: z.string().nullable().optional(),
  tariffId: z.string().nullable().optional(),
  meterType: z.enum(['grid', 'dg', 'solar']).nullable().optional(),
});
