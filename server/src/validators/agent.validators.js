import { z } from 'zod';

const uuid = z.string().uuid();

export const addAgentSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    ownerId: uuid.optional(),
  }).strict(),
});

export const linkParamSchema = z.object({ params: z.object({ linkId: uuid }) });

export const updateAgentSchema = z.object({
  params: z.object({ linkId: uuid }),
  body: z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(40).nullable().optional(),
  }).strict(),
});

export const agentLinkStatusSchema = z.object({
  params: z.object({ linkId: uuid }),
  body: z.object({ status: z.enum(['active', 'inactive']) }).strict(),
});
