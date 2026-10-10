import { z } from 'zod';

export const financialSummarySchema = z.object({
  query: z.object({
    propertyId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
});

export const occupancyReportSchema = z.object({
  query: z.object({ propertyId: z.string().uuid().optional() }),
});

export const rentCollectionReportSchema = financialSummarySchema;

export const maintenanceSummaryReportSchema = occupancyReportSchema;
