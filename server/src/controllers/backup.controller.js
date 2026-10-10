import { pipeline } from 'node:stream/promises';
import { timingSafeEqual } from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as backups from '../services/backup/backup.service.js';
import { runDueBackup } from '../services/backup/scheduler.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const status = asyncHandler(async (req, res) => sendSuccess(res, { data: await backups.getStatus() }));

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const r = await backups.listBackups({ page, pageSize, skip, take, type: req.query.type, status: req.query.status });
  sendSuccess(res, { data: r.backups, meta: r.meta });
});

export const get = asyncHandler(async (req, res) => sendSuccess(res, { data: await backups.getBackup(req.params.id) }));

export const create = asyncHandler(async (req, res) => {
  const row = await backups.startBackup({ type: 'MANUAL', admin: req.platformAdmin, req });
  // The dump runs in the background; the screen polls GET /backups/:id.
  setImmediate(() => { backups.runBackupJob(row.id, { admin: req.platformAdmin, req }); });
  sendSuccess(res, { statusCode: 202, data: backups.serializeBackup(row), message: 'Backup started.' });
});

export const verify = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await backups.verifyBackup(req.params.id, req.platformAdmin, req), message: 'Verification finished.' });
});

export const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await backups.deleteBackup(req.params.id, req.platformAdmin, req), message: 'Backup deleted.' });
});

export const download = asyncHandler(async (req, res) => {
  const { stream, filename, size } = await backups.openBackupDownload(req.params.id, req.platformAdmin, req);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (size) res.setHeader('Content-Length', String(size));
  await pipeline(stream, res);
});

export const getPolicy = asyncHandler(async (req, res) => sendSuccess(res, { data: await backups.getPolicy() }));
export const setPolicy = asyncHandler(async (req, res) => sendSuccess(res, { data: await backups.setPolicy(req.body, req.platformAdmin, req), message: 'Retention updated.' }));

export const prepareRestore = asyncHandler(async (req, res) => sendSuccess(res, { data: await backups.prepareRestore(req.body.backupId, req.platformAdmin, req) }));
export const startRestore = asyncHandler(async (req, res) => {
  sendSuccess(res, { statusCode: 202, data: await backups.startRestore(req.body, req.platformAdmin, req), message: 'Restore started.' });
});
export const listRestores = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const r = await backups.listRestores({ page, pageSize, skip, take });
  sendSuccess(res, { data: r.restores, meta: r.meta });
});
export const getRestore = asyncHandler(async (req, res) => sendSuccess(res, { data: await backups.getRestore(req.params.id) }));

// For an external scheduler (Render cron job, GitHub Actions) so the daily
// backup still happens when the web instance has been put to sleep.
export const cronRun = asyncHandler(async (req, res) => {
  const secret = env.BACKUP_CRON_SECRET;
  const given = String(req.headers['x-cron-secret'] ?? '');
  const ok = secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw AppError.unauthorized();
  sendSuccess(res, { data: await runDueBackup() });
});
