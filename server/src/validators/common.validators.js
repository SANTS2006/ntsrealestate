import { z } from 'zod';

// Shared query-string fragment for every paginated list endpoint — see
// utils/pagination.js and docs/api/api-guide.md.
export const paginationQuery = {
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(200).optional(),
};

export const uuidParam = (name) => ({ [name]: z.string().uuid(`Invalid ${name}.`) });
