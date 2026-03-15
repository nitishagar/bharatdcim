import { z } from 'zod';

const ReadingItem = z.object({
  id: z.string().min(1),
  meterId: z.string().min(1),
  timestamp: z.string().min(1),
  kWh: z.number().nullable().optional(),
  kW: z.number().nullable().optional(),
  voltage: z.number().nullable().optional(),
  current: z.number().nullable().optional(),
  powerFactor: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  slotType: z.enum(['peak', 'normal', 'off-peak']).nullable().optional(),
  slotName: z.string().nullable().optional(),
  ratePaisa: z.number().int().nullable().optional(),
  uploadId: z.string().nullable().optional(),
});

export const CreateReadingsSchema = z.object({
  readings: z.array(ReadingItem).min(1),
});

/** SNMP agent batch format — accepts both snake_case and camelCase */
const BatchReadingItem = z.object({
  meter_id: z.string().optional(),
  meterId: z.string().optional(),
  timestamp: z.string().min(1),
  kWh: z.number().nullable().optional(),
  kW: z.number().nullable().optional(),
  powerFactor: z.number().nullable().optional(),
}).refine(
  (r) => r.meter_id || r.meterId,
  { message: 'meter_id or meterId is required', path: ['meter_id'] },
);

export const BatchReadingsSchema = z.object({
  readings: z.array(BatchReadingItem).min(1),
  agentId: z.string().optional(),
  agent_id: z.string().optional(),
});
