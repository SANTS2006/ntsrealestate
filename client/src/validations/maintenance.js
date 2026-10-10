import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());

export const PRIORITIES = ['low', 'medium', 'high', 'emergency'];

// Staff form: pick property (+ optional unit/tenant) directly.
export const maintenanceStaffFormSchema = z.object({
  propertyId: z.string().uuid('Select a property.'),
  unitId: optionalString(z.string().uuid()),
  tenantId: optionalString(z.string().uuid()),
  title: z.string().trim().min(1, 'Title is required.').max(200),
  description: optionalString(z.string().trim().max(2000)),
  priority: optionalString(z.enum(PRIORITIES)),
});

// Tenant self-service form: only picks which of their own units the issue
// is in (server derives tenantId/propertyId from the caller's own tenant
// profile) — see maintenanceRequest.service.js.
export const maintenanceTenantFormSchema = z.object({
  unitId: z.string().uuid('Select a unit.'),
  title: z.string().trim().min(1, 'Title is required.').max(200),
  description: optionalString(z.string().trim().max(2000)),
  priority: optionalString(z.enum(PRIORITIES)),
});

export const assignMaintenanceFormSchema = z.object({
  assignedTo: z.string().uuid('Select a staff member.'),
});

export const workOrderCreateFormSchema = z.object({
  vendorId: optionalString(z.string().uuid()),
  assignedStaffId: optionalString(z.string().uuid()),
  scheduledDate: optionalString(z.string()),
  estimatedCost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(9_999_999_999).optional()),
});

export const workOrderCompleteFormSchema = z.object({
  actualCost: z.preprocess(emptyToUndefined, z.coerce.number().nonnegative().max(9_999_999_999).optional()),
});
