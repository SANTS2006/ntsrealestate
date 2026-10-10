import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../../config/logger.js';
import { validate } from '../../middleware/validate.js';

export const clientErrorsRouter = Router();

// Where the browser reports a crash, so failures people hit are visible in the
// server log. Anonymous by design (a crash can happen before sign-in), so it is
// tightly limited, size-capped, and only ever logged — never stored or echoed.
const limiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false, handler: (req, res) => res.status(204).end() });

const schema = z.object({
  body: z.object({
    kind: z.string().max(40),
    message: z.string().max(400),
    name: z.string().max(80).optional(),
    stack: z.string().max(1500).optional(),
    path: z.string().max(200).optional(),
    componentStack: z.string().max(700).optional(),
  }).passthrough(),
});

clientErrorsRouter.post('/', limiter, validate(schema), (req, res) => {
  const { kind, message, name, stack, path, componentStack } = req.body;
  logger.warn({ requestId: req.id, clientError: { kind, message, name, path, stack, componentStack } }, 'browser error report');
  res.status(204).end();
});
