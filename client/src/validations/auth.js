import { z } from 'zod';

// These mirror server/src/validators/auth.validators.js closely enough to
// give immediate feedback, but they are a UX convenience only — the server
// re-validates everything and is the only source of truth (see
// docs/security/security-architecture.md).
const email = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.');
const password = z.string().min(12, 'Password must be at least 12 characters.');

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email,
  password,
  referralCode: z.string().trim().max(20).optional(),
  agreedToTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the Terms & Conditions and Privacy Policy to continue.' }),
  }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.'),
});

export const mfaCodeSchema = z.object({
  code: z.string().trim().min(6, 'Enter the 6-digit code from your authenticator app, or a recovery code.'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
