import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200).optional(),
    legalName: z.string().trim().max(200).nullable().optional(),
    registrationNumber: z.string().trim().max(100).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    region: z.string().trim().max(100).nullable().optional(),
    country: z.string().trim().max(100).nullable().optional(),
    settings: z.record(z.unknown()).optional(),
  }).strict(),
});
