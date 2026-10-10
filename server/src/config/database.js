import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { env, isProduction } from './env.js';
import { logger } from './logger.js';

// Neon's serverless driver uses WebSockets under the hood; in Node (as
// opposed to an edge runtime) it needs a ws implementation supplied.
neonConfig.webSocketConstructor = ws;

// Bounded, reused connections: at most DATABASE_POOL_SIZE per instance; idle
// ones are released, and a wait for a free one fails fast instead of piling up.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});
pool.on('error', (err) => logger.error({ err }, 'database pool error'));
const adapter = new PrismaNeon(pool);

export const prisma = new PrismaClient({
  adapter,
  log: isProduction
    ? [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }]
    : [{ emit: 'event', level: 'error' }, { emit: 'event', level: 'warn' }, { emit: 'event', level: 'query' }],
});

// Route Prisma's own event log through the structured logger instead of
// letting it write to stdout directly — keeps log shape consistent and lets
// us redact if a query ever includes sensitive params in dev.
prisma.$on('error', (e) => logger.error({ err: e }, 'prisma error'));
prisma.$on('warn', (e) => logger.warn({ warning: e }, 'prisma warning'));
if (!isProduction) {
  prisma.$on('query', (e) => logger.debug({ duration: e.duration }, `query: ${e.query}`));
}

export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, 'database connectivity check failed');
    return false;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  await pool.end();
}

// Opens several database connections up front (the first query on a cold
// connection costs seconds) and then pings now and then so the serverless
// database does not go to sleep while the API is running.
export async function warmDatabase() {
  try {
    await Promise.all([1, 2, 3, 4].map(() => prisma.$queryRaw`SELECT 1`));
  } catch (err) {
    logger.warn({ err }, 'database warm-up failed');
  }
  const timer = setInterval(() => { prisma.$queryRaw`SELECT 1`.catch(() => {}); }, 4 * 60 * 1000);
  timer.unref();
}
