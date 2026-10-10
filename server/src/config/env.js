import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Fail fast and loud if the runtime environment is misconfigured — never start
// the server with silently-defaulted secrets in production.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL (Neon pooled connection) is required'),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL (Neon direct connection) is required'),

  // This is a single-tenant deployment (one real estate company, not a
  // multi-org SaaS) — every new registration joins this one organization
  // as a `tenant` rather than creating its own org. See
  // auth.service.js#registerOrganization.
  // Legacy: only used by the un-slugged /public/* routes. The listings site now
  // addresses its company by URL name (/public/orgs/:orgSlug/*), which needs
  // no configuration at all.
  // Optional TURN relay so voice/video calls work across strict firewalls.
  TURN_URLS: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  PRIMARY_ORGANIZATION_ID: z.string().uuid('PRIMARY_ORGANIZATION_ID must be the UUID of an organization').optional(),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().int().positive().default(12),

  // 32-byte (64 hex char) key used only to symmetrically encrypt TOTP MFA
  // secrets at rest (AES-256-GCM) — distinct from the signing secrets below
  // because it protects data that must be decrypted, not just verified.
  MFA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_ISSUER: z.string().default('rems-api'),
  JWT_AUDIENCE: z.string().default('rems-clients'),

  // Database connections this instance may hold open. Keep (instances x this)
  // below the database's own connection limit.
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(10),
  SESSION_POOL_SIZE: z.coerce.number().int().min(1).max(20).default(5),
  // A request that runs longer than this is cut off with a 503 instead of
  // hanging a connection (uploads and backups are exempt).
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),

  // ---- Backup & Recovery (see docs/operations/backup-and-recovery.md) ----
  // 'local' writes to BACKUP_LOCAL_DIR (development only: container disks are
  // wiped on redeploy); 's3' uses any S3-compatible bucket (AWS S3,
  // Cloudflare R2, Backblaze B2...).
  BACKUP_STORAGE: z.enum(['local', 's3']).default('local'),
  BACKUP_LOCAL_DIR: z.string().default('./backups'),
  // 32-byte key as 64 hex characters. Without it backups are refused in
  // production: they hold every user's data.
  BACKUP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'BACKUP_ENCRYPTION_KEY must be a 64-character hex string').optional(),
  // Daily run time in UTC, "HH:MM".
  BACKUP_SCHEDULE: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'BACKUP_SCHEDULE must look like 02:00').default('02:00'),
  BACKUP_SCHEDULER_ENABLED: z.enum(['true', 'false']).default('true'),
  // Keep the newest N verified daily backups, and anything younger than DAYS.
  BACKUP_RETENTION_COUNT: z.coerce.number().int().min(1).default(7),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
  // Lets an external scheduler (Render cron, GitHub Actions) trigger the daily
  // backup even while a free-tier instance is asleep: POST /api/v1/internal/backups/run
  BACKUP_CRON_SECRET: z.string().min(24).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS is required (comma-separated exact origins)'),

  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),

  // Brevo's transactional HTTP API is the preferred send path when
  // BREVO_API_KEY is set (see integrations/email/mailer.js) — it needs no
  // separate SMTP login to guess at, just this one key. EMAIL_HOST/USER/
  // PASSWORD remain supported as a fallback for any other SMTP provider.
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  SUPPORT_EMAIL: z.string().email().optional(),

  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(10),
});

// A line like `S3_ENDPOINT=` (left blank in .env) means "not set", not "set to nothing".
const cleanedEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = envSchema.safeParse(cleanedEnv);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const corsOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
