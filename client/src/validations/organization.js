import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());

export const organizationFormSchema = z.object({
  name: z.string().trim().min(2, 'Organization name is required.').max(200),
  legalName: optionalString(z.string().trim().max(200)),
  registrationNumber: optionalString(z.string().trim().max(100)),
  phone: optionalString(z.string().trim().max(30)),
  address: optionalString(z.string().trim().max(300)),
  city: optionalString(z.string().trim().max(100)),
  region: optionalString(z.string().trim().max(100)),
  country: optionalString(z.string().trim().max(100)),
});
