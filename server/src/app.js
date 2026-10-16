import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { logger } from './config/logger.js';
import { isProduction } from './config/env.js';
import {
  helmetMiddleware,
  corsMiddleware,
  requestIdMiddleware,
  generalRateLimiter,
  originCheckMiddleware,
} from './middleware/security.js';
import { sessionMiddleware } from './config/session.js';
import { issueCsrfToken } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { idempotency } from './middleware/idempotency.js';
import { requestOriginMiddleware } from './utils/appUrl.js';
import { v1Router } from './routes/v1/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The free-hosting deployment target (see docs/deployment/render.md) runs
// frontend and backend as one Node process on one origin — no separate
// static host, no custom domain needed, and it sidesteps cross-site cookie
// complications entirely (the session cookie is SameSite=Lax, which only
// works same-origin). `client/dist` is the Vite production build, built as
// part of the deploy's build step, sitting two levels up from server/src/.
const clientDistDir = path.join(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  // Behind a reverse proxy (Render/Railway/Fly/Vercel edge) in production —
  // needed so `secure` cookies and rate-limit IP detection see the real
  // client IP/protocol via X-Forwarded-* rather than the proxy's.
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(requestOriginMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(originCheckMiddleware);
  app.use(generalRateLimiter);

  // Body size limits guard against oversized-payload DoS; JSON only for the
  // API surface (file uploads use multipart, handled per-route with Multer).
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.use(sessionMiddleware);
  app.use(issueCsrfToken);

  app.use('/api/v1', idempotency);
  app.use('/api/v1', v1Router);

  if (isProduction) {
    // Built files are fingerprinted (a new deploy gets new names), so they can
    // be cached for a year; index.html and the service worker must always be
    // re-checked or people keep a page that points at files that no longer exist.
    app.use(express.static(clientDistDir, {
      index: false,
      setHeaders(res, filePath) {
        if (/[\\/]assets[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else if (/(index\.html|sw\.js|manifest\.webmanifest|offline\.html)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
        else res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }));
    // A missing file (an old chunk removed by a newer deploy) must be a real
    // 404. Answering with index.html here made the browser try to run HTML as
    // JavaScript, which is what turned some pages blank until a refresh.
    app.get(/^\/(assets\/.*|.*\.(js|mjs|css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|json|webmanifest|txt))$/, (req, res) => {
      res.status(404).type('text/plain').set('Cache-Control', 'no-store').send('Not found');
    });
    // SPA fallback for client-side routes (e.g. /dashboard, /properties/:id)
    // — anything not under /api/ that doesn't match a static asset gets
    // index.html so React Router can take over. Unmatched /api/ paths fall
    // through to notFoundHandler below instead, so they still 404 as JSON.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
