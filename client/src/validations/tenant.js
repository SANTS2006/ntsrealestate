import { z } from 'zod';

const emptyToUndefined = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optionalString = (schema) => z.preprocess(emptyToUndefined, schema.optional());

// Flat emergencyContact* fields are recombined into the nested object the
// server expects (see server/src/validators/tenant.validators.js) — see
// TenantFormModal's onSubmit.
export const tenantFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.').max(100),
    lastName: z.string().trim().min(1, 'Last name is required.').max(100),
    email: optionalString(z.string().trim().toLowerCase().email('Enter a valid email address.').max(254)),
    phone: optionalString(z.string().trim().max(30)),
    emergencyContactName: optionalString(z.string().trim().max(200)),
    emergencyContactPhone: optionalString(z.string().trim().max(30)),
    emergencyContactRelationship: optionalString(z.string().trim().max(100)),
    buildingId: optionalString(z.string().uuid()),
    unitId: optionalString(z.string().uuid()),
  })
  .superRefine((data, ctx) => {
    const hasAny = data.emergencyContactName || data.emergencyContactPhone || data.emergencyContactRelationship;
    if (hasAny && !data.emergencyContactName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['emergencyContactName'], message: 'Required if adding an emergency contact.' });
    }
    if (hasAny && !data.emergencyContactPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['emergencyContactPhone'], message: 'Required if adding an emergency contact.' });
    }
  });
