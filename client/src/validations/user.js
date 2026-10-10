import { z } from 'zod';

const email = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.');
const roleName = z.string().min(1, 'Select a role.');

export const inviteUserFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email,
  role: roleName,
});

export const changeUserRoleFormSchema = z.object({
  role: roleName,
});
