import { z } from 'zod';

/** Accepts both snake_case and camelCase for Go agent compatibility */
export const HeartbeatSchema = z.object({
  agent_id: z.string().optional(),
  agentId: z.string().optional(),
  agent_version: z.string().nullable().optional(),
  agentVersion: z.string().nullable().optional(),
  device_count: z.number().int().min(0).optional(),
  deviceCount: z.number().int().min(0).optional(),
  unsynced_count: z.number().int().min(0).optional(),
  unsyncedCount: z.number().int().min(0).optional(),
  tenant_id: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
}).refine(
  (b) => b.agent_id || b.agentId,
  { message: 'agent_id or agentId is required', path: ['agent_id'] },
);
