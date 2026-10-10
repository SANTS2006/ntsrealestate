import { z } from 'zod';
import { rentalFormSchema } from './property.js';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalNumber = (schema) => z.preprocess(emptyToUndefined, schema.optional());
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());

export const buildingFormSchema = z.object({
  name: z.string().trim().min(1, 'Building name is required.').max(200),
  code: optionalString(z.string().trim().max(50)),
  floors: optionalNumber(z.coerce.number().int().min(0).max(300)),
  description: optionalString(z.string().trim().max(2000)),
  isShared: z.boolean().optional(),
});

// A building rented as a whole (properties of the "buildings" kind) also needs its price and details.
export const buildingWithRentalFormSchema = buildingFormSchema.extend({ rental: rentalFormSchema });
