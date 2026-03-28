import { z } from 'zod';

export const CreateAlertRuleSchema = z.object({
  id: z.string().min(1),
  meterId: z.string().optional(),
  metric: z.enum(['temperature', 'humidity']),
  operator: z.enum(['gt', 'lt', 'gte', 'lte']),
  threshold: z.number().int(),
  severity: z.enum(['warning', 'critical']).default('warning'),
});

export const UpdateAlertRuleSchema = z.object({
  meterId: z.string().optional(),
  metric: z.enum(['temperature', 'humidity']).optional(),
  operator: z.enum(['gt', 'lt', 'gte', 'lte']).optional(),
  threshold: z.number().int().optional(),
  severity: z.enum(['warning', 'critical']).optional(),
  enabled: z.number().int().min(0).max(1).optional(),
});

export type CreateAlertRule = z.infer<typeof CreateAlertRuleSchema>;
export type UpdateAlertRule = z.infer<typeof UpdateAlertRuleSchema>;
