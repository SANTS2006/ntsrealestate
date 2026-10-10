import { Router } from 'express';
import { checkDatabaseConnection } from '../../config/database.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const healthRouter = Router();

// Liveness: process is up. No dependency checks — used by the host's
// process supervisor to decide whether to restart the container/process.
healthRouter.get('/live', (req, res) => {
  sendSuccess(res, { data: { status: 'ok' }, message: 'Service is alive.' });
});

// Readiness: safe to receive traffic. Checks external dependencies but never
// leaks connection strings, hostnames, or credentials in the response.
healthRouter.get('/', asyncHandler(async (req, res) => {
  const dbHealthy = await checkDatabaseConnection();
  const cloudinaryConfigured = Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );

  const status = dbHealthy ? 'ok' : 'degraded';
  sendSuccess(res, {
    statusCode: dbHealthy ? 200 : 503,
    data: {
      status,
      dependencies: {
        database: dbHealthy ? 'connected' : 'unreachable',
        cloudinary: cloudinaryConfigured ? 'configured' : 'not_configured',
      },
      timestamp: new Date().toISOString(),
    },
    message: `Service is ${status}.`,
  });
}));
