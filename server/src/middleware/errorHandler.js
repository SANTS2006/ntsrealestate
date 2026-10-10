import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

export function notFoundHandler(req, res) {
  sendError(res, {
    code: 'ROUTE_NOT_FOUND',
    message: `No route matches ${req.method} ${req.originalUrl}`,
    statusCode: 404,
  });
}

// Centralized error handler — the single place where an error becomes an HTTP
// response. Never leak stack traces, SQL, file paths, or internal messages to
// the client in production; operational (AppError) messages are always safe.
export function errorHandler(err, req, res, next) {
  const requestId = req.id;

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, 'validation error');
    return sendError(res, {
      code: 'VALIDATION_ERROR',
      message: 'One or more fields failed validation.',
      statusCode: 422,
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof AppError) {
    const level = err.statusCode >= 500 ? 'error' : 'warn';
    logger[level]({ requestId, code: err.code, err }, err.message);
    return sendError(res, {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
  }

  // Body-parser rejections (e.g. an upload over the size cap) are the caller's
  // mistake, not a server fault.
  if (err?.type === 'entity.too.large') {
    return sendError(res, { code: 'PAYLOAD_TOO_LARGE', message: 'That upload is too large.', statusCode: 413 });
  }

  // Known Prisma error shapes are translated, never passed through raw.
  if (err?.code?.startsWith?.('P')) {
    logger.error({ requestId, prismaCode: err.code, err }, 'database error');
    if (err.code === 'P2002') {
      return sendError(res, { code: 'CONFLICT', message: 'A record with these details already exists.', statusCode: 409 });
    }
    if (err.code === 'P2025') {
      return sendError(res, { code: 'RESOURCE_NOT_FOUND', message: 'The requested resource could not be found.', statusCode: 404 });
    }
    return sendError(res, { code: 'INTERNAL_ERROR', message: 'A database error occurred.', statusCode: 500 });
  }

  logger.error({ requestId, err }, 'unhandled error');
  return sendError(res, {
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'An unexpected error occurred.' : err.message,
    statusCode: 500,
  });
}
