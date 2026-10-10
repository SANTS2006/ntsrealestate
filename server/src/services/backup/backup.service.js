import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { prisma } from '../../config/database.js';
import { env, isProduction } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/AppError.js';
import { buildPaginationMeta } from '../../utils/pagination.js';
import { verifyPassword } from '../../auth/password.js';
import { platformAudit } from '../platformAudit.service.js';
import { dumpToFile, inspectBackupFile, restoreFromFile } from './engine.js';
import { keyFromHex } from './fileCrypto.js';
import { getBackupStorage } from './storage.js';

const SYSTEM_ACTOR = { id: null, firstName: 'System', lastName: 'Scheduler', email: 'system@scheduler' };
const HEARTBEAT_MS = 15_000;
const STALE_AFTER_MS = 10 * 60 * 1000;
const PRE_RESTORE_PHRASE = 'RESTORE DATABASE';
const CONFIRM_TTL_MS = 5 * 60 * 1000;
const POLICY_KEY = 'backup_policy';

const actorName = (a) => (a ? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.email : 'System');

// ---------------------------------------------------------------- policy ----

export async function getPolicy() {
  const row = await prisma.platformSetting.findUnique({ where: { key: POLICY_KEY } });
  const v = row?.value ?? {};
  return {
    retentionCount: Number.isInteger(v.retentionCount) ? v.retentionCount : env.BACKUP_RETENTION_COUNT,
    retentionDays: Number.isInteger(v.retentionDays) ? v.retentionDays : env.BACKUP_RETENTION_DAYS,
  };
}

export async function setPolicy({ retentionCount, retentionDays }, admin, req) {
  const value = { retentionCount, retentionDays };
  await prisma.platformSetting.upsert({ where: { key: POLICY_KEY }, create: { key: POLICY_KEY, value }, update: { value } });
  await platformAudit({ actor: admin, action: 'BACKUP_POLICY_CHANGED', targetType: 'backup_policy', details: value, req });
  return getPolicy();
}

// ------------------------------------------------------------- serialising ---

export function serializeBackup(b) {
  return {
    id: b.id,
    type: b.type,
    status: b.status,
    verification: b.verification,
    valid: b.status === 'COMPLETED' && b.verification === 'VERIFIED',
    sizeBytes: b.sizeBytes === null || b.sizeBytes === undefined ? null : Number(b.sizeBytes),
    checksumSha256: b.checksumSha256,
    encrypted: b.encrypted,
    storage: b.storageProvider,
    tableCount: b.tableCount,
    rowCount: b.rowCount,
    schemaMigration: b.schemaMigration,
    createdBy: b.createdByName,
    errorMessage: b.errorMessage,
    startedAt: b.startedAt,
    completedAt: b.completedAt,
    verifiedAt: b.verifiedAt,
    deletedAt: b.deletedAt,
  };
}

export function serializeRestore(r) {
  return {
    id: r.id,
    backupId: r.backupId,
    safetyBackupId: r.safetyBackupId,
    status: r.status,
    startedBy: r.startedByName,
    backupTakenAt: r.backupTakenAt,
    errorMessage: r.errorMessage,
    rolledBack: r.rolledBack,
    verification: r.verification,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    inProgress: !['completed', 'failed'].includes(r.status),
  };
}

// --------------------------------------------------------------- retention ---

// Pure, so it can be tested without a database. `backups` are every row;
// `protectedIds` are ones an active restore needs. Returns the ids to delete.
export function selectBackupsToDelete(backups, { retentionCount, retentionDays }, protectedIds = new Set(), now = Date.now()) {
  const valid = backups
    .filter((b) => b.status === 'COMPLETED' && b.verification === 'VERIFIED')
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  if (valid.length <= 1) return []; // never delete the only valid backup
  const keep = new Set([valid[0].id]); // never delete the newest valid backup
  const cutoff = now - retentionDays * 86_400_000;
  let counted = 0;
  for (const b of valid) {
    if (protectedIds.has(b.id)) keep.add(b.id);
    if (b.type === 'PRE_RESTORE') {
      if (new Date(b.startedAt).getTime() >= cutoff) keep.add(b.id);
      continue;
    }
    counted += 1;
    if (counted <= retentionCount || new Date(b.startedAt).getTime() >= cutoff) keep.add(b.id);
  }
  return valid.filter((b) => !keep.has(b.id)).map((b) => b.id);
}

async function applyRetention() {
  const [policy, all, activeRestore] = await Promise.all([
    getPolicy(),
    prisma.backup.findMany({ where: { status: 'COMPLETED' } }),
    prisma.backupRestore.findFirst({ where: { status: { notIn: ['completed', 'failed'] } } }),
  ]);
  const protectedIds = new Set(activeRestore ? [activeRestore.backupId, activeRestore.safetyBackupId].filter(Boolean) : []);
  const doomed = selectBackupsToDelete(all, policy, protectedIds);
  for (const id of doomed) await deleteBackupInternal(id, SYSTEM_ACTOR, null, 'retention');
  return doomed.length;
}

async function deleteBackupInternal(id, actor, req, reason) {
  const b = await prisma.backup.findUnique({ where: { id } });
  if (!b || b.status === 'DELETED') return;
  try {
    if (b.storageKey) await getBackupStorage().delete(b.storageKey);
  } catch (err) {
    logger.error({ err, backupId: id }, 'could not delete backup file');
    throw AppError.badGateway?.('The backup file could not be removed from storage.') ?? err;
  }
  await prisma.backup.update({ where: { id }, data: { status: 'DELETED', deletedAt: new Date() } });
  await platformAudit({ actor, action: 'BACKUP_DELETED', targetType: 'backup', targetId: id, details: { reason }, req });
}

// Admin-initiated delete, with the same guards as retention.
export async function deleteBackup(id, admin, req) {
  const b = await prisma.backup.findUnique({ where: { id } });
  if (!b || b.status === 'DELETED') throw AppError.notFound('Backup not found.');
  if (['PENDING', 'RUNNING'].includes(b.status)) throw AppError.conflict('This backup is still running.');
  const [all, activeRestore] = await Promise.all([
    prisma.backup.findMany({ where: { status: 'COMPLETED', verification: 'VERIFIED' }, orderBy: { startedAt: 'desc' } }),
    prisma.backupRestore.findFirst({ where: { status: { notIn: ['completed', 'failed'] } } }),
  ]);
  if (activeRestore && [activeRestore.backupId, activeRestore.safetyBackupId].includes(id)) throw AppError.conflict('A restore is using this backup.');
  if (all.length && all[0].id === id) throw AppError.conflict('The newest valid backup cannot be deleted.');
  if (all.length === 1 && all[0].id === id) throw AppError.conflict('The only valid backup cannot be deleted.');
  await deleteBackupInternal(id, admin, req, 'manual');
  return { deleted: true };
}

// ------------------------------------------------------------------ queries --

export async function listBackups({ page, pageSize, skip, take, type, status }) {
  const where = { ...(type ? { type } : {}), ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    prisma.backup.findMany({ where, orderBy: { startedAt: 'desc' }, skip, take }),
    prisma.backup.count({ where }),
  ]);
  return { backups: rows.map(serializeBackup), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getBackup(id) {
  const b = await prisma.backup.findUnique({ where: { id } });
  if (!b) throw AppError.notFound('Backup not found.');
  return serializeBackup(b);
}

export async function listRestores({ page, pageSize, skip, take }) {
  const [rows, total] = await Promise.all([
    prisma.backupRestore.findMany({ orderBy: { startedAt: 'desc' }, skip, take }),
    prisma.backupRestore.count(),
  ]);
  return { restores: rows.map(serializeRestore), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getRestore(id) {
  const r = await prisma.backupRestore.findUnique({ where: { id } });
  if (!r) throw AppError.notFound('Restore not found.');
  return serializeRestore(r);
}

export function nextScheduledRun(now = new Date()) {
  const [h, m] = env.BACKUP_SCHEDULE.split(':').map(Number);
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export async function getStatus() {
  await recoverStaleJobs();
  const [latest, latestValid, running, activeRestore, counts, policy] = await Promise.all([
    prisma.backup.findFirst({ where: { status: { in: ['COMPLETED', 'FAILED'] } }, orderBy: { startedAt: 'desc' } }),
    prisma.backup.findFirst({ where: { status: 'COMPLETED', verification: 'VERIFIED' }, orderBy: { startedAt: 'desc' } }),
    prisma.backup.findFirst({ where: { status: { in: ['PENDING', 'RUNNING'] } } }),
    prisma.backupRestore.findFirst({ where: { status: { notIn: ['completed', 'failed'] } } }),
    prisma.backup.groupBy({ by: ['status'], _count: true }),
    getPolicy(),
  ]);
  const ageHours = latestValid ? (Date.now() - new Date(latestValid.startedAt).getTime()) / 3_600_000 : null;
  const health = !latestValid ? 'no_valid_backup' : ageHours > 36 ? 'stale' : 'healthy';
  return {
    health,
    encryptionConfigured: Boolean(keyFromHex(env.BACKUP_ENCRYPTION_KEY)),
    storage: env.BACKUP_STORAGE,
    durableStorage: env.BACKUP_STORAGE !== 'local',
    schedule: { enabled: env.BACKUP_SCHEDULER_ENABLED === 'true', dailyAtUtc: env.BACKUP_SCHEDULE, nextRunAt: nextScheduledRun() },
    policy,
    latestBackup: latest ? serializeBackup(latest) : null,
    latestValidBackup: latestValid ? serializeBackup(latestValid) : null,
    runningBackup: running ? serializeBackup(running) : null,
    activeRestore: activeRestore ? serializeRestore(activeRestore) : null,
    totals: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  };
}

// --------------------------------------------------------------- creating ----

async function sha256OfFile(filePath) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

function startHeartbeat(model, id) {
  const timer = setInterval(() => {
    prisma[model].update({ where: { id }, data: { heartbeatAt: new Date() } }).catch(() => {});
  }, HEARTBEAT_MS);
  timer.unref();
  return () => clearInterval(timer);
}

function encryptionKeyOrThrow() {
  const key = keyFromHex(env.BACKUP_ENCRYPTION_KEY);
  if (!key && isProduction) throw new Error('BACKUP_ENCRYPTION_KEY is not set. Backups hold every user\'s data and are not created unencrypted in production.');
  return key;
}

// Creates the record, refusing if anything else is running. The database
// itself enforces "one at a time" (a unique index), so two instances racing
// here cannot both win.
export async function startBackup({ type, admin = null, req = null }) {
  if (type !== 'PRE_RESTORE') {
    const restoring = await prisma.backupRestore.findFirst({ where: { status: { notIn: ['completed', 'failed'] } } });
    if (restoring) throw AppError.conflict('A restore is in progress. Backups resume when it finishes.');
  }
  await recoverStaleJobs();
  try {
    const row = await prisma.backup.create({
      data: {
        type, status: 'RUNNING', storageProvider: env.BACKUP_STORAGE, encrypted: false,
        createdById: admin?.id ?? null, createdByName: actorName(admin), requestId: req?.id ?? null,
      },
    });
    return row;
  } catch (err) {
    if (err?.code === 'P2002') throw AppError.conflict('A backup is already running.');
    throw err;
  }
}

// Does the work for an already-created record. Never throws: the outcome is
// written to the record, the audit log, and the log.
export async function runBackupJob(id, { admin = null, req = null } = {}) {
  const stopHeartbeat = startHeartbeat('backup', id);
  const dir = path.join(os.tmpdir(), `ntsrealestate-backup-${id}`);
  const actor = admin ?? SYSTEM_ACTOR;
  try {
    await mkdir(dir, { recursive: true });
    const key = encryptionKeyOrThrow();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const storageKey = `ntsrealestate-${stamp}-${id.slice(0, 8)}.rbk`;
    const tmpFile = path.join(dir, storageKey);

    const dumped = await dumpToFile({ filePath: tmpFile, key });
    const checksum = await sha256OfFile(tmpFile);
    await getBackupStorage().put(storageKey, tmpFile);

    await prisma.backup.update({
      where: { id },
      data: {
        status: 'COMPLETED', completedAt: new Date(), sizeBytes: BigInt(dumped.sizeBytes), checksumSha256: checksum,
        encrypted: dumped.encrypted, storageKey, tableCount: dumped.tables.length, rowCount: dumped.rowCount,
        tableCounts: dumped.counts, schemaMigration: dumped.migration,
      },
    });
    await platformAudit({ actor, action: 'BACKUP_CREATED', targetType: 'backup', targetId: id, details: { sizeBytes: dumped.sizeBytes, rows: dumped.rowCount, encrypted: dumped.encrypted }, req });

    // Only a backup that passes verification counts as a recovery point.
    const verified = await verifyBackupRecord(id, actor, req);
    if (verified) await applyRetention().catch((err) => logger.error({ err }, 'backup retention failed'));
    return verified;
  } catch (err) {
    logger.error({ err, backupId: id }, 'backup failed');
    await prisma.backup.update({ where: { id }, data: { status: 'FAILED', completedAt: new Date(), errorMessage: String(err.message).slice(0, 500) } }).catch(() => {});
    await platformAudit({ actor, action: 'BACKUP_FAILED', targetType: 'backup', targetId: id, details: { error: String(err.message).slice(0, 300) }, req });
    return false;
  } finally {
    stopHeartbeat();
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ------------------------------------------------------------- verification --

// Re-reads the stored copy: file present, non-empty, checksum equal, decrypts,
// every row parses, and row counts equal what the dump recorded.
async function verifyBackupRecord(id, actor, req) {
  const b = await prisma.backup.findUnique({ where: { id } });
  const dir = path.join(os.tmpdir(), `ntsrealestate-verify-${id}-${randomBytes(4).toString('hex')}`);
  try {
    if (!b || b.status !== 'COMPLETED' || !b.storageKey) throw new Error('Only a completed backup can be verified.');
    const storage = getBackupStorage();
    if (!(await storage.exists(b.storageKey))) throw new Error('The backup file is missing from storage.');
    const size = await storage.size(b.storageKey);
    if (!size) throw new Error('The backup file is empty.');
    if (b.sizeBytes !== null && b.sizeBytes !== undefined && BigInt(size) !== b.sizeBytes) throw new Error('The stored size differs from the size recorded at creation.');

    await mkdir(dir, { recursive: true });
    const local = path.join(dir, 'verify.rbk');
    await storage.download(b.storageKey, local);
    if ((await sha256OfFile(local)) !== b.checksumSha256) throw new Error('Checksum mismatch: the stored file has changed since it was created.');

    const info = await inspectBackupFile({ filePath: local, key: b.encrypted ? keyFromHex(env.BACKUP_ENCRYPTION_KEY) : null });
    const recorded = b.tableCounts ?? {};
    for (const [table, n] of Object.entries(recorded)) {
      if ((info.counts[table] ?? 0) !== n) throw new Error(`Row count mismatch in "${table}".`);
    }
    await prisma.backup.update({ where: { id }, data: { verification: 'VERIFIED', verifiedAt: new Date(), errorMessage: null } });
    await platformAudit({ actor, action: 'BACKUP_VERIFIED', targetType: 'backup', targetId: id, details: { rows: info.rowCount }, req });
    return true;
  } catch (err) {
    logger.error({ err, backupId: id }, 'backup verification failed');
    await prisma.backup.update({ where: { id }, data: { verification: 'FAILED', errorMessage: String(err.message).slice(0, 500) } }).catch(() => {});
    await platformAudit({ actor, action: 'BACKUP_VERIFICATION_FAILED', targetType: 'backup', targetId: id, details: { error: String(err.message).slice(0, 300) }, req });
    return false;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function verifyBackup(id, admin, req) {
  const b = await prisma.backup.findUnique({ where: { id } });
  if (!b || b.status === 'DELETED') throw AppError.notFound('Backup not found.');
  if (b.status !== 'COMPLETED') throw AppError.conflict('Only a completed backup can be verified.');
  await verifyBackupRecord(id, admin, req);
  return getBackup(id);
}

// --------------------------------------------------------------- download ----

export async function openBackupDownload(id, admin, req) {
  const b = await prisma.backup.findUnique({ where: { id } });
  if (!b || b.status !== 'COMPLETED' || !b.storageKey) throw AppError.notFound('Backup not found.');
  await platformAudit({ actor: admin, action: 'BACKUP_DOWNLOADED', targetType: 'backup', targetId: id, req });
  return { stream: await getBackupStorage().getStream(b.storageKey), filename: b.storageKey, size: b.sizeBytes === null || b.sizeBytes === undefined ? null : Number(b.sizeBytes) };
}

// ----------------------------------------------------------------- restore ---

function signConfirmation(adminId, backupId, expires) {
  return createHmac('sha256', env.SESSION_SECRET).update(`restore|${adminId}|${backupId}|${expires}`).digest('hex');
}

// Step 1+2: checks the backup is safe to restore and tells the admin exactly
// what will happen. Returns a short-lived token that step 3 must present.
export async function prepareRestore(backupId, admin, req) {
  const b = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!b || b.status !== 'COMPLETED') throw AppError.notFound('Backup not found.');
  if (b.verification !== 'VERIFIED') throw AppError.conflict('Only a verified backup can be restored. Verify it first.');
  const [activeRestore, activeBackup] = await Promise.all([
    prisma.backupRestore.findFirst({ where: { status: { notIn: ['completed', 'failed'] } } }),
    prisma.backup.findFirst({ where: { status: { in: ['PENDING', 'RUNNING'] } } }),
  ]);
  if (activeRestore) throw AppError.conflict('A restore is already in progress.');
  if (activeBackup) throw AppError.conflict('A backup is running. Wait for it to finish.');
  if (b.encrypted && !keyFromHex(env.BACKUP_ENCRYPTION_KEY)) throw AppError.conflict('This backup is encrypted and the encryption key is not configured on this server.');

  const expires = Date.now() + CONFIRM_TTL_MS;
  await platformAudit({ actor: admin, action: 'RESTORE_PREPARED', targetType: 'backup', targetId: backupId, req });
  return {
    backup: serializeBackup(b),
    token: `${expires}.${signConfirmation(admin.id, backupId, expires)}`,
    expiresAt: new Date(expires),
    requiredPhrase: PRE_RESTORE_PHRASE,
    warning: `You are about to restore the database to the state captured on ${new Date(b.startedAt).toISOString()}. Everything created or changed after that moment will be lost. A safety backup of the current database is taken first.`,
  };
}

// Step 3: explicit confirmation → starts the background job and returns at once.
export async function startRestore({ backupId, token, confirmation, password }, admin, req) {
  if (confirmation !== PRE_RESTORE_PHRASE) throw AppError.badRequest(`Type ${PRE_RESTORE_PHRASE} exactly to confirm.`);
  const [expiresRaw, sig] = String(token ?? '').split('.');
  const expires = Number(expiresRaw);
  const expected = signConfirmation(admin.id, backupId, expires);
  const ok = sig && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok || !Number.isFinite(expires) || expires < Date.now()) throw AppError.badRequest('The confirmation has expired. Start again.');

  const account = await prisma.platformAdmin.findUnique({ where: { id: admin.id } });
  if (!account || !(await verifyPassword(account.passwordHash, password))) {
    await platformAudit({ actor: admin, action: 'RESTORE_DENIED', targetType: 'backup', targetId: backupId, details: { reason: 'wrong password' }, req });
    throw AppError.forbidden('Your password is not correct.');
  }

  const b = await prisma.backup.findUnique({ where: { id: backupId } });
  if (!b || b.status !== 'COMPLETED' || b.verification !== 'VERIFIED') throw AppError.conflict('Only a verified backup can be restored.');
  const activeBackup = await prisma.backup.findFirst({ where: { status: { in: ['PENDING', 'RUNNING'] } } });
  if (activeBackup) throw AppError.conflict('A backup is running. Wait for it to finish.');

  let row;
  try {
    row = await prisma.backupRestore.create({
      data: { backupId, status: 'pending', startedById: admin.id, startedByName: actorName(admin), backupTakenAt: b.startedAt, requestId: req?.id ?? null },
    });
  } catch (err) {
    if (err?.code === 'P2002') throw AppError.conflict('A restore is already in progress.');
    throw err;
  }
  await platformAudit({ actor: admin, action: 'RESTORE_STARTED', targetType: 'backup', targetId: backupId, details: { restoreId: row.id }, req });
  setImmediate(() => { runRestoreJob(row.id, admin, req).catch((err) => logger.error({ err }, 'restore job crashed')); });
  return serializeRestore(row);
}

const setRestore = (id, data) => prisma.backupRestore.update({ where: { id }, data: { heartbeatAt: new Date(), ...data } });

export async function runRestoreJob(restoreId, admin, req) {
  const stopHeartbeat = startHeartbeat('backupRestore', restoreId);
  const dir = path.join(os.tmpdir(), `ntsrealestate-restore-${restoreId}`);
  try {
    const restore = await prisma.backupRestore.findUnique({ where: { id: restoreId } });
    const b = await prisma.backup.findUnique({ where: { id: restore.backupId } });
    await mkdir(dir, { recursive: true });

    // 1. The chosen backup must still be intact.
    await setRestore(restoreId, { status: 'preparing' });
    const intact = await verifyBackupRecord(b.id, admin, req);
    if (!intact) throw new Error('The selected backup failed its integrity check and was not restored.');

    // 2. Safety copy of the database as it is right now.
    await setRestore(restoreId, { status: 'backing_up_current_database' });
    const safety = await startBackup({ type: 'PRE_RESTORE', admin, req });
    await setRestore(restoreId, { safetyBackupId: safety.id });
    const safe = await runBackupJob(safety.id, { admin, req });
    if (!safe) throw new Error('The safety backup of the current database failed, so nothing was restored.');

    // 3. Replace the data (one transaction; all-or-nothing).
    await setRestore(restoreId, { status: 'restoring' });
    const local = path.join(dir, 'restore.rbk');
    await getBackupStorage().download(b.storageKey, local);
    const result = await restoreFromFile({
      filePath: local,
      key: b.encrypted ? keyFromHex(env.BACKUP_ENCRYPTION_KEY) : null,
      onPhase: (phase) => { setRestore(restoreId, { status: phase }).catch(() => {}); },
    });

    await setRestore(restoreId, {
      status: 'completed', completedAt: new Date(),
      verification: { tables: result.tables.length, rows: Object.values(result.counts).reduce((x, y) => x + y, 0), matchesBackup: true },
    });
    await platformAudit({ actor: admin, action: 'RESTORE_COMPLETED', targetType: 'backup', targetId: b.id, details: { restoreId, safetyBackupId: safety.id }, req });
  } catch (err) {
    logger.error({ err, restoreId }, 'restore failed');
    // Failures before or during the transaction leave the live data untouched.
    await setRestore(restoreId, { status: 'failed', completedAt: new Date(), errorMessage: String(err.message).slice(0, 500), rolledBack: true }).catch(() => {});
    await platformAudit({ actor: admin, action: 'RESTORE_FAILED', targetType: 'backup', targetId: null, details: { restoreId, error: String(err.message).slice(0, 300) }, req });
    await platformAudit({ actor: admin, action: 'RESTORE_ROLLBACK', targetType: 'restore', targetId: restoreId, details: { note: 'transaction rolled back; live data unchanged' }, req });
  } finally {
    stopHeartbeat();
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ------------------------------------------------------- crash recovery ------

// A job whose server died stops sending heartbeats. Mark it failed so the
// "only one at a time" lock is released. An interrupted restore was inside one
// transaction, which the database rolled back when the connection dropped.
export async function recoverStaleJobs() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const [b, r] = await Promise.all([
    prisma.backup.updateMany({
      where: { status: { in: ['PENDING', 'RUNNING'] }, heartbeatAt: { lt: cutoff } },
      data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Interrupted: the server stopped while this backup was running.' },
    }),
    prisma.backupRestore.updateMany({
      where: { status: { notIn: ['completed', 'failed'] }, heartbeatAt: { lt: cutoff } },
      data: { status: 'failed', completedAt: new Date(), rolledBack: true, errorMessage: 'Interrupted: the server stopped during the restore. The database was left unchanged.' },
    }),
  ]);
  if (b.count || r.count) logger.warn({ backups: b.count, restores: r.count }, 'recovered stale backup/restore jobs');
}
