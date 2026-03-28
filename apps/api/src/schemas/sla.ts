import { z } from 'zod';

export const CreateSLASchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['uptime', 'pue', 'power_availability', 'response_time']),
  targetBps: z.number().int().positive(),
  measurementWindow: z.enum(['daily', 'weekly', 'monthly']).optional().default('monthly'),
  meterId: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.type === 'uptime' && d.targetBps > 10000) {
    ctx.addIssue({ code: 'custom', path: ['targetBps'], message: 'Uptime targetBps cannot exceed 10000 (100%)' });
  }
  if (d.type === 'pue' && d.targetBps < 10000) {
    ctx.addIssue({ code: 'custom', path: ['targetBps'], message: 'PUE targetBps must be >= 10000 (PUE >= 1.0)' });
  }
});

export const UpdateSLASchema = z.object({
  name: z.string().min(1).max(100).optional(),
  targetBps: z.number().int().positive().optional(),
  measurementWindow: z.enum(['daily', 'weekly', 'monthly']).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export const UpdateViolationSchema = z.object({
  status: z.enum(['acknowledged', 'resolved']),
});
