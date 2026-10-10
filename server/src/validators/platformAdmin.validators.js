import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const hexColor = z.string().trim().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'Enter a valid hex color, e.g. #0F172A.');

export const platformAdminLoginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1).max(128),
  }).strict(),
});

// multipart/form-data — the logo file itself is handled by Multer
// (middleware/upload.js) before this ever runs, so `req.body` here only
// carries the text fields.
export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(150),
    slug: z.string().trim().min(2).max(50),
    adminFirstName: z.string().trim().min(1).max(100),
    adminLastName: z.string().trim().min(1).max(100),
    adminEmail: email,
    primaryColor: hexColor,
    secondaryColor: hexColor,
  }).strict(),
});

export const organizationStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['active', 'suspended']),
  }).strict(),
});

export const orgSlugParamSchema = z.object({
  params: z.object({ orgSlug: z.string().trim().min(1).max(50) }),
});

const password = z.string().min(1).max(128);
const uuidParam = z.object({ id: z.string().uuid() });

export const platformForgotPasswordSchema = z.object({ body: z.object({ email }).strict() });

export const platformResetPasswordSchema = z.object({
  body: z.object({ token: z.string().min(10).max(200), password }).strict(),
});

export const platformChangePasswordSchema = z.object({
  body: z.object({ currentPassword: password, newPassword: password }).strict(),
});

export const platformProfileSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
  }).strict(),
});

export const createPlatformAdminSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email,
  }).strict(),
});

export const platformAdminStatusSchema = z.object({
  params: uuidParam,
  body: z.object({ isActive: z.boolean() }).strict(),
});

export const organizationIdParamSchema = z.object({ params: uuidParam });

export const updateOrganizationSchema = z.object({
  params: uuidParam,
  body: z.object({
    name: z.string().trim().min(2).max(150).optional(),
    email: email.optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    primaryColor: hexColor.optional(),
    secondaryColor: hexColor.optional(),
  }).strict(),
});

export const sendAdminResetSchema = z.object({
  params: uuidParam,
  body: z.object({ userId: z.string().uuid() }).strict(),
});

export const maintenanceSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
    message: z.string().trim().max(1000).optional(),
    scope: z.enum(['all', 'selected']).optional(),
    pages: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    endsAt: z.string().datetime().nullable().optional(),
    notifyUsers: z.boolean().optional(),
  }).strict(),
});
