import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

// The whole backup service against the real database (a dump is read-only, so
// this is safe), writing to a throwaway folder with a throwaway key. Restores
// are NOT run here — they replace live data; the restore engine itself is
// covered against a scratch schema in backup-engine.test.js.

process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('hex');
let svc;
let storageDir;
let prisma;
let LocalBackupStorage;
const createdIds = [];

beforeAll(async () => {
  ({ prisma } = await import('../../../server/src/config/database.js'));
  svc = await import('../../../server/src/services/backup/backup.service.js');
  ({ LocalBackupStorage } = await import('../../../server/src/services/backup/storage.js'));
  const { setBackupStorageForTests } = await import('../../../server/src/services/backup/storage.js');
  storageDir = await mkdtemp(path.join(os.tmpdir(), 'rems-bk-svc-'));
  setBackupStorageForTests(new LocalBackupStorage(storageDir));
  // A clean slate for the "one running at a time" rules.
  await prisma.backup.updateMany({ where: { status: { in: ['PENDING', 'RUNNING'] } }, data: { status: 'FAILED', completedAt: new Date() } });
}, 60_000);

afterAll(async () => {
  await prisma.backup.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.backupRestore.deleteMany({ where: { backupId: { in: createdIds } } });
  await rm(storageDir, { recursive: true, force: true });
}, 60_000);

describe('creating and verifying a backup', () => {
  let id;

  it('creates a backup of the live database that ends up VERIFIED, encrypted, with metadata', async () => {
    const row = await svc.startBackup({ type: 'MANUAL', admin: { id: randomUUID(), firstName: 'Test', lastName: 'Admin', email: 't@example.test' } });
    id = row.id; createdIds.push(id);
    expect(row.status).toBe('RUNNING');
    const ok = await svc.runBackupJob(id);
    expect(ok).toBe(true);

    const b = await svc.getBackup(id);
    expect(b).toMatchObject({ type: 'MANUAL', status: 'COMPLETED', verification: 'VERIFIED', valid: true, encrypted: true, createdBy: 'Test Admin' });
    expect(b.sizeBytes).toBeGreaterThan(100);
    expect(b.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(b.tableCount).toBeGreaterThan(30);
    expect(b.rowCount).toBeGreaterThan(0);
    expect(b).not.toHaveProperty('storageKey'); // storage internals are not exposed
    expect(await readdir(storageDir)).toHaveLength(1);
  }, 120_000);

  it('row counts in the backup match the live database', async () => {
    const stored = (await prisma.backup.findUnique({ where: { id } })).tableCounts;
    for (const table of ['organizations', 'users', 'properties', 'units']) {
      const live = (await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${table}"`))[0].n;
      expect(Math.abs(stored[table] - live)).toBeLessThanOrEqual(5); // tiny drift allowed if other work writes meanwhile
    }
  });

  it('records audit events for the backup', async () => {
    const logs = await prisma.platformAuditLog.findMany({ where: { targetId: id }, select: { action: true } });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('BACKUP_CREATED');
    expect(actions).toContain('BACKUP_VERIFIED');
  });

  it('detects a changed file when verified again, and a missing file', async () => {
    const files = await readdir(storageDir);
    const target = path.join(storageDir, files[0]);
    const fs = await import('node:fs/promises');
    const bytes = await fs.readFile(target);
    bytes[200] ^= 0x01;
    await fs.writeFile(target, bytes);
    const admin = { id: randomUUID(), firstName: 'T', lastName: 'A', email: 't@example.test' };
    const after = await svc.verifyBackup(id, admin);
    expect(after.verification).toBe('FAILED');
    expect(after.valid).toBe(false);
    expect(after.errorMessage).toMatch(/checksum/i);

    await fs.rm(target);
    const missing = await svc.verifyBackup(id, admin);
    expect(missing.verification).toBe('FAILED');
    expect(missing.errorMessage).toMatch(/missing/i);
  }, 60_000);

  it('refuses to restore a backup that is not verified', async () => {
    await expect(svc.prepareRestore(id, { id: randomUUID(), firstName: 'T', lastName: 'A', email: 't@example.test' })).rejects.toThrow(/verified/i);
  });
});

describe('only one backup at a time (across instances)', () => {
  it('lets exactly one of several simultaneous starts win', async () => {
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => svc.startBackup({ type: 'MANUAL' })));
    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    won.forEach((w) => createdIds.push(w.value.id));
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(5);
    expect(lost.every((l) => l.reason.statusCode === 409)).toBe(true);
    // release the lock
    await prisma.backup.update({ where: { id: won[0].value.id }, data: { status: 'FAILED', completedAt: new Date() } });
  }, 60_000);

  it('releases the lock of a job whose server died (no heartbeat)', async () => {
    const stuck = await svc.startBackup({ type: 'MANUAL' });
    createdIds.push(stuck.id);
    await prisma.backup.update({ where: { id: stuck.id }, data: { heartbeatAt: new Date(Date.now() - 30 * 60 * 1000) } });
    const next = await svc.startBackup({ type: 'MANUAL' }); // recovers the stale one first
    createdIds.push(next.id);
    expect((await prisma.backup.findUnique({ where: { id: stuck.id } })).status).toBe('FAILED');
    await prisma.backup.update({ where: { id: next.id }, data: { status: 'FAILED', completedAt: new Date() } });
  }, 60_000);
});

describe('restore safeguards', () => {
  const admin = { id: randomUUID(), firstName: 'T', lastName: 'A', email: 't@example.test' };
  let validId;

  beforeAll(async () => {
    const row = await svc.startBackup({ type: 'MANUAL', admin });
    validId = row.id; createdIds.push(validId);
    await svc.runBackupJob(validId);
  }, 120_000);

  it('requires the exact phrase, a valid unexpired token, and the right password', async () => {
    const prep = await svc.prepareRestore(validId, admin);
    expect(prep.requiredPhrase).toBe('RESTORE DATABASE');
    expect(prep.warning).toMatch(/lost/i);

    await expect(svc.startRestore({ backupId: validId, token: prep.token, confirmation: 'restore', password: 'x' }, admin)).rejects.toThrow(/exactly/i);
    await expect(svc.startRestore({ backupId: validId, token: '123.abc', confirmation: 'RESTORE DATABASE', password: 'x' }, admin)).rejects.toThrow(/expired/i);
    // a token made for another admin does not work
    await expect(svc.startRestore({ backupId: validId, token: prep.token, confirmation: 'RESTORE DATABASE', password: 'x' }, { ...admin, id: randomUUID() })).rejects.toThrow(/expired/i);
    // right token, but the account does not exist / wrong password
    await expect(svc.startRestore({ backupId: validId, token: prep.token, confirmation: 'RESTORE DATABASE', password: 'wrong' }, admin)).rejects.toThrow(/password/i);
    expect(await prisma.backupRestore.count({ where: { backupId: validId } })).toBe(0); // nothing started
  }, 60_000);

  it('never deletes the newest valid or only valid backup', async () => {
    await expect(svc.deleteBackup(validId, admin)).rejects.toThrow(/newest|only/i);
  });
});
