import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const listPublicListingsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    neighborhood: z.string().trim().max(100).optional(),
    type: z.string().trim().max(100).optional(),
    maxPrice: z.coerce.number().positive().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    minBeds: z.coerce.number().int().min(0).optional(),
    minBaths: z.coerce.number().int().min(0).optional(),
    kind: z.enum(['whole', 'building', 'unit']).optional(),
    offer: z.enum(['rent', 'buy', 'lease']).optional(),
    furnished: z.enum(['true', 'false']).optional(),
    // comma separated facility names
    amenities: z.string().trim().max(500).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['newest', 'price-asc', 'price-desc']).optional(),
  }),
});

export const publicListingIdParamSchema = z.object({ params: z.object(uuidParam('id')) });

const contactFields = {
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Last name is required.').max(100),
  email: z.string().trim().email('Enter a valid email address.').max(200),
  phone: z.string().trim().min(1, 'Phone number is required.').max(30),
  message: z.string().trim().min(1, 'Message is required.').max(2000),
};

export const listingInquirySchema = z.object({
  params: z.object(uuidParam('id')),
  body: z.object(contactFields).strict(),
});

export const generalContactSchema = z.object({
  body: z.object(contactFields).strict(),
});

export const listPublicLandsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    type: z.string().trim().max(50).optional(),
    city: z.string().trim().max(100).optional(),
    q: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    minArea: z.coerce.number().nonnegative().optional(),
    sort: z.enum(['newest', 'price-asc', 'price-desc', 'area-desc']).optional(),
  }),
});
