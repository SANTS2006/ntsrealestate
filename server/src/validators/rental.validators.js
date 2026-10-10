import { z } from 'zod';

const uuid = z.string().uuid();

export const requestRentalSchema = z.object({
  body: z.object({
    unitId: uuid.optional(),
    buildingId: uuid.optional(),
  }).strict().refine((b) => Boolean(b.unitId) !== Boolean(b.buildingId), { message: 'Provide either a unitId or a buildingId.' }),
});

export const tenantRentalsParamSchema = z.object({ params: z.object({ tenantId: uuid }) });
