import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

const optional = (max) => z.string().trim().max(max).optional();

// Anonymous submissions from the public website. `website` is a honeypot: a
// person never sees (or fills) it, a form-spamming bot usually does — see
// platformInquiry.service.js, which silently drops those.
export const createPlatformInquirySchema = z.object({
  body: z.object({
    kind: z.enum(['contact', 'demo']),
    name: z.string().trim().min(1, 'Please enter your name.').max(120),
    email: z.string().trim().email('Enter a valid email address.').max(200),
    phone: optional(30),
    company: optional(160),
    interest: optional(120),
    portfolioSize: optional(60),
    message: optional(3000),
    source: optional(200),
    website: optional(200),
  }).strict().superRefine((v, ctx) => {
    if (v.kind === 'demo') {
      if (!v.company) ctx.addIssue({ code: 'custom', path: ['company'], message: 'Please enter your company.' });
      if (!v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Please enter a phone or WhatsApp number.' });
    } else if ((v.message ?? '').length < 10) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'Please write a short message (at least 10 characters).' });
    }
  }),
});

export const INQUIRY_STATUSES = ['new', 'read', 'replied', 'archived'];

export const listPlatformInquiriesSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: z.enum(INQUIRY_STATUSES).optional(),
    kind: z.enum(['contact', 'demo']).optional(),
  }),
});

export const inquiryIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

export const updatePlatformInquirySchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object({ status: z.enum(INQUIRY_STATUSES) }).strict(),
});
