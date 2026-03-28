import { z } from 'zod';

const VALID_EVENTS = ['capacity_warning', 'capacity_critical', 'sla_warning', 'sla_breach'] as const;

export const CreateNotificationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['email', 'webhook']),
  destination: z.string().min(1),
  events: z.array(z.enum(VALID_EVENTS)).min(1, 'At least one event must be selected'),
  status: z.enum(['active', 'paused']).optional().default('active'),
}).superRefine((d, ctx) => {
  if (d.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.destination)) {
    ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Must be a valid email address' });
  }
  if (d.type === 'webhook') {
    try {
      new URL(d.destination);
    } catch {
      ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Must be a valid URL' });
    }
  }
});

export const UpdateNotificationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  destination: z.string().min(1).optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
  status: z.enum(['active', 'paused']).optional(),
});
