import { z } from 'zod';

export const EnvReadingItemSchema = z.object({
  meter_id: z.string().min(1),
  timestamp: z.string().min(1),
  temp_c: z.number().optional(),
  humidity: z.number().optional(),
});

export const BatchEnvReadingsSchema = z.array(EnvReadingItemSchema).min(1).max(10000);
export type BatchEnvReadings = z.infer<typeof BatchEnvReadingsSchema>;
