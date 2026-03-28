import { z } from 'zod';

export const CreateThresholdSchema = z.object({
  meterId: z.string().min(1),
  metric: z.enum(['kwh_daily', 'kw_peak', 'kwh_monthly']),
  warningValue: z.number().positive(),
  criticalValue: z.number().positive(),
  windowDays: z.number().int().min(1).max(365).optional(),
}).refine((d) => d.criticalValue >= d.warningValue, {
  message: 'criticalValue must be >= warningValue',
  path: ['criticalValue'],
});

export const UpdateThresholdSchema = z.object({
  warningValue: z.number().positive().optional(),
  criticalValue: z.number().positive().optional(),
  windowDays: z.number().int().min(1).max(365).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

export const ForecastQuerySchema = z.object({
  meter_id: z.string().min(1),
  window_days: z.coerce.number().int().min(7).max(365).optional().default(30),
});

export const AlertsQuerySchema = z.object({
  meter_id: z.string().optional(),
  status: z.enum(['active', 'acknowledged', 'resolved']).optional(),
});

export const UpdateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'resolved']),
});
