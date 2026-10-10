import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());

export const INSPECTION_TYPES = ['move_in', 'move_out', 'routine', 'property', 'unit'];

export const inspectionScheduleFormSchema = z.object({
  propertyId: z.string().uuid('Select a property.'),
  buildingId: optionalString(z.string().uuid()),
  unitId: optionalString(z.string().uuid()),
  inspectorId: optionalString(z.string().uuid()),
  inspectionDate: z.string().min(1, 'Inspection date is required.'),
  type: z.enum(INSPECTION_TYPES, { errorMap: () => ({ message: 'Select an inspection type.' }) }),
});

export const inspectionEditFormSchema = z.object({
  inspectionDate: optionalString(z.string()),
  inspectorId: optionalString(z.string().uuid()),
  condition: optionalString(z.string().trim().max(500)),
  notes: optionalString(z.string().trim().max(2000)),
});

export const inspectionCompleteFormSchema = z.object({
  condition: optionalString(z.string().trim().max(500)),
  notes: optionalString(z.string().trim().max(2000)),
});
