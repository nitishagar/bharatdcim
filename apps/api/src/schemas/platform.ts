import { z } from 'zod';

const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(500),
  stateCode: z.string().min(1).max(5),
  gstin: z.string().regex(gstinRegex, 'Invalid GSTIN format').nullable().optional(),
  billingAddress: z.string().max(2000).nullable().optional(),
});

export const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  stateCode: z.string().min(1).max(5).optional(),
  gstin: z.string().regex(gstinRegex, 'Invalid GSTIN format').nullable().optional(),
  billingAddress: z.string().max(2000).nullable().optional(),
  legalName: z.string().max(500).nullable().optional(),
  address1: z.string().max(2000).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  pincode: z.string().max(10).nullable().optional(),
});
