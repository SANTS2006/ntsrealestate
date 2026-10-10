import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { purgeOldIdempotencyKeys } from '../../middleware/idempotency.js';
import { recoverStaleJobs, runBackupJob, startBackup } from './backup.service.js';

const TICK_MS = 60_000;
const MAX_ATTEMPTS_PER_DAY = 3;
const RETRY_AFTER_FAILURE_MS = 30 * 60 * 1000;
let timer = null;
let running = false;

export function scheduledTimeToday(now = new Date()) {
  const [h, m] = env.BACKUP_SCHEDULE.split(':').map(Number);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
}

// Pure decision, testable: given today's automatic attempts, is a backup due?
export function isBackupDue(attempts, now = new Date(), scheduledAt = scheduledTimeToday(now)) {
  if (now < scheduledAt) return false;
  const today = attempts.filter((a) => new Date(a.startedAt) >= scheduledAt);
  if (today.some((a) => a.status !== 'FAILED')) return false; // running or done
  if (today.length >= MAX_ATTEMPTS_PER_DAY) return false;
  const lastFailure = Math.max(0, ...today.map((a) => new Date(a.completedAt ?? a.startedAt).getTime()));
  return now.getTime() - lastFailure >= RETRY_AFTER_FAILURE_MS;
}

// Safe to call from every instance at once: whichever inserts the "running"
// row first wins (the database allows only one), the others skip.
export async function runDueBackup() {
  await recoverStaleJobs();
  const scheduledAt = scheduledTimeToday();
  const attempts = await prisma.backup.findMany({ where: { type: 'AUTOMATIC', startedAt: { gte: scheduledAt } }, select: { status: true, startedAt: true, completedAt: true } });
  if (!isBackupDue(attempts, new Date(), scheduledAt)) return { ran: false, reason: 'not_due' };
  let row;
  try {
    row = await startBackup({ type: 'AUTOMATIC' });
  } catch (err) {
    if (err.statusCode === 409) return { ran: false, reason: 'busy' };
    throw err;
  }
  const ok = await runBackupJob(row.id);
  return { ran: true, backupId: row.id, ok };
}

export function startBackupScheduler() {
  if (env.BACKUP_SCHEDULER_ENABLED !== 'true' || env.NODE_ENV === 'test' || timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await runDueBackup(); if (new Date().getUTCMinutes() === 0) await purgeOldIdempotencyKeys(); } catch (err) { logger.error({ err }, 'scheduled backup check failed'); } finally { running = false; }
  }, TICK_MS);
  timer.unref();
  logger.info(`Daily backup scheduler on (${env.BACKUP_SCHEDULE} UTC, storage: ${env.BACKUP_STORAGE})`);
}

export function stopBackupScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
