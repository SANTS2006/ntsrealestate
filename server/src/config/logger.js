import pino from 'pino';
import { env, isProduction } from './env.js';

// Structured logging. Never log request/response bodies wholesale (they can
// contain passwords, tokens, or PII) — only the whitelisted fields below.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.mfaSecret',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.mfaSecret',
  '*.mfa_secret_hash',
  '*.accessToken',
  '*.refreshToken',
  '*.jwt',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isProduction ? 'info' : 'debug',
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
});
