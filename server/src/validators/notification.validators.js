import { z } from 'zod';
import { paginationQuery, uuidParam } from './common.validators.js';

export const listNotificationsSchema = z.object({
  query: z.object({ ...paginationQuery, unreadOnly: z.coerce.boolean().optional(), all: z.coerce.boolean().optional() }),
});

export const notificationIdParamSchema = z.object({ params: z.object(uuidParam('id')) });
