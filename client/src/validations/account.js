import { z } from 'zod';

const password = z.string().min(12, 'Password must be at least 12 characters.');

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const mfaConfirmFormSchema = z.object({
  code: z.string().trim().length(6, 'Enter the 6-digit code from your authenticator app.'),
});

export const mfaDisableFormSchema = z.object({
  password: z.string().min(1, 'Enter your current password.'),
  code: z.string().trim().length(6, 'Enter the 6-digit code from your authenticator app.'),
});
