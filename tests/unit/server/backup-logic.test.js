import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { selectBackupsToDelete } from '../../../server/src/services/backup/backup.service.js';
import { isBackupDue } from '../../../server/src/services/backup/scheduler.js';
import { writeBackupFile, openBackupFile, keyFromHex } from '../../../server/src/services/backup/fileCrypto.js';
import { LocalBackupStorage } from '../../../server/src/services/backup/storage.js';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const mk = (id, daysAgo, extra = {}) => ({ id, type: 'AUTOMATIC', status: 'COMPLETED', verification: 'VERIFIED', startedAt: new Date(NOW - daysAgo * DAY), ...extra });
const policy = { retentionCount: 3, retentionDays: 5 };

describe('retention', () => {
  it('keeps the newest N and anything inside the retention window, deletes the rest', () => {
    const backups = [0, 1, 2, 3, 4, 8, 9, 10].map((d) => mk(`b${d}`, d));
    // newest 3 (0,1,2) + inside 5 days (3,4) are kept; 8,9,10 go.
    expect(selectBackupsToDelete(backups, policy, new Set(), NOW).sort()).toEqual(['b10', 'b8', 'b9']);
  });
  it('never deletes the only valid backup, however old', () => {
    expect(selectBackupsToDelete([mk('old', 400)], policy, new Set(), NOW)).toEqual([]);
  });
  it('never deletes the newest valid backup, even when it is older than the window', () => {
    const backups = [mk('a', 100), mk('b', 200), mk('c', 300), mk('d', 400), mk('e', 500)];
    const doomed = selectBackupsToDelete(backups, { retentionCount: 1, retentionDays: 1 }, new Set(), NOW);
    expect(doomed).not.toContain('a');
    expect(doomed.sort()).toEqual(['b', 'c', 'd', 'e']);
  });
  it('ignores failed and unverified backups when deciding what counts', () => {
    const backups = [mk('f', 0, { status: 'FAILED' }), mk('u', 0, { verification: 'UNVERIFIED' }), mk('v1', 20), mk('v2', 30)];
    const doomed = selectBackupsToDelete(backups, { retentionCount: 1, retentionDays: 1 }, new Set(), NOW);
    expect(doomed).toEqual(['v2']); // v1 is the newest *valid* one; f and u are never touched here
  });
  it('protects backups an active restore needs', () => {
    const backups = [mk('new', 0), mk('mid', 20), mk('oldest', 40)];
    const doomed = selectBackupsToDelete(backups, { retentionCount: 1, retentionDays: 1 }, new Set(['oldest']), NOW);
    expect(doomed).toEqual(['mid']);
  });
  it('keeps pre-restore safety backups for the retention window and does not count them toward N', () => {
    const backups = [mk('a', 0), mk('b', 1), mk('safety', 2, { type: 'PRE_RESTORE' }), mk('safetyOld', 60, { type: 'PRE_RESTORE' })];
    const doomed = selectBackupsToDelete(backups, { retentionCount: 2, retentionDays: 3 }, new Set(), NOW);
    expect(doomed).toEqual(['safetyOld']);
  });
});

describe('daily schedule', () => {
  const scheduledAt = new Date(Date.UTC(2026, 9, 10, 2, 0));
  const at = (h, m = 0) => new Date(Date.UTC(2026, 9, 10, h, m));
  it('is not due before the scheduled time', () => {
    expect(isBackupDue([], at(1, 59), scheduledAt)).toBe(false);
  });
  it('is due after the scheduled time when nothing has run today (also catches up after downtime)', () => {
    expect(isBackupDue([], at(2, 1), scheduledAt)).toBe(true);
    expect(isBackupDue([], at(17), scheduledAt)).toBe(true);
  });
  it('is not due while one is running or once one has completed today', () => {
    expect(isBackupDue([{ status: 'RUNNING', startedAt: at(2, 1) }], at(2, 5), scheduledAt)).toBe(false);
    expect(isBackupDue([{ status: 'COMPLETED', startedAt: at(2, 1), completedAt: at(2, 2) }], at(9), scheduledAt)).toBe(false);
  });
  it('retries a failure after 30 minutes, at most 3 times a day', () => {
    const failed = (h, m) => ({ status: 'FAILED', startedAt: at(h, m), completedAt: at(h, m + 1) });
    expect(isBackupDue([failed(2, 1)], at(2, 20), scheduledAt)).toBe(false);
    expect(isBackupDue([failed(2, 1)], at(2, 40), scheduledAt)).toBe(true);
    expect(isBackupDue([failed(2, 1), failed(3, 0), failed(4, 0)], at(9), scheduledAt)).toBe(false);
  });
  it('yesterday\'s backup does not count as today\'s', () => {
    expect(isBackupDue([{ status: 'COMPLETED', startedAt: new Date(Date.UTC(2026, 9, 9, 2, 1)) }], at(3), scheduledAt)).toBe(true);
  });
});

describe('backup file encryption', () => {
  const text = (n) => Array.from({ length: n }, (_, i) => `t\t{"i":${i},"s":"row ${i}"}\n`).join('');
  async function readAll(stream) {
    const lines = [];
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) lines.push(line);
    return lines;
  }

  it('round-trips through gzip + AES-GCM, with no plaintext on disk', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rbk-'));
    try {
      const key = keyFromHex(randomBytes(32).toString('hex'));
      const file = path.join(dir, 'a.rbk');
      const { sizeBytes, encrypted } = await writeBackupFile(file, key, async (write) => { await write(text(5000)); await write(text(10)); });
      expect(encrypted).toBe(true);
      expect(sizeBytes).toBeGreaterThan(20);
      const lines = await readAll(await openBackupFile(file, key));
      expect(lines).toHaveLength(5010);
      expect(lines[4999]).toBe('t\t{"i":4999,"s":"row 4999"}');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it('refuses a missing or wrong key', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rbk-'));
    try {
      const key = keyFromHex(randomBytes(32).toString('hex'));
      const file = path.join(dir, 'b.rbk');
      await writeBackupFile(file, key, async (write) => { await write(text(50)); });
      await expect(openBackupFile(file, null)).rejects.toThrow(/key/i);
      await expect(readAll(await openBackupFile(file, keyFromHex(randomBytes(32).toString('hex'))))).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe('local backup storage', () => {
  it('only ever touches files inside its own folder', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'rbk-store-'));
    try {
      const storage = new LocalBackupStorage(dir);
      for (const bad of ['../evil.rbk', '..%2Fevil', 'a/b.rbk', '/etc/passwd', 'x', '']) {
        expect(() => storage.resolve(bad)).toThrow(/Invalid backup storage key/);
      }
      expect(storage.resolve('ntsrealestate-20261010T020000Z-abcdef12.rbk').startsWith(path.resolve(dir))).toBe(true);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
