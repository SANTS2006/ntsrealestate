import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { connectDirect, dumpToFile, inspectBackupFile, restoreFromFile, orderByDependencies } from '../../../server/src/services/backup/engine.js';
import { keyFromHex } from '../../../server/src/services/backup/fileCrypto.js';

// Exercises the real dump/restore engine against the real database, but only
// inside a throwaway schema it creates and drops: production tables are never
// written to. Tables include foreign keys (parent → child → grandchild) so the
// ordering, truncate, reinsert and count verification are all exercised.

const SCHEMA = `bk_test_${randomBytes(4).toString('hex')}`;
const key = keyFromHex(randomBytes(32).toString('hex'));
let dir;
let admin;
const q = (sql, params) => admin.query(sql, params);

async function counts() {
  const out = {};
  for (const t of ['parents', 'children', 'grandchildren']) out[t] = (await q(`SELECT count(*)::int n FROM ${SCHEMA}.${t}`)).rows[0].n;
  return out;
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'rems-bk-test-'));
  admin = await connectDirect();
  await q(`CREATE SCHEMA ${SCHEMA}`);
  await q(`CREATE TABLE ${SCHEMA}._prisma_migrations (migration_name text, finished_at timestamptz)`);
  await q(`INSERT INTO ${SCHEMA}._prisma_migrations VALUES ('20260101_test', now())`);
  await q(`CREATE TABLE ${SCHEMA}.parents (id uuid PRIMARY KEY, name text NOT NULL, amount numeric(14,2), meta jsonb, created timestamptz DEFAULT now())`);
  await q(`CREATE TABLE ${SCHEMA}.children (id uuid PRIMARY KEY, parent_id uuid NOT NULL REFERENCES ${SCHEMA}.parents(id), qty int NOT NULL, note text)`);
  await q(`CREATE TABLE ${SCHEMA}.grandchildren (child_id uuid NOT NULL REFERENCES ${SCHEMA}.children(id), tag text NOT NULL, PRIMARY KEY (child_id, tag))`);
  for (let i = 0; i < 25; i += 1) {
    const pid = (await q(`INSERT INTO ${SCHEMA}.parents (id, name, amount, meta) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [`parent ${i} "quoted"\ttab\nnewline ünïcode`, `${i}.37`, JSON.stringify({ i, nested: { ok: true } })])).rows[0].id;
    for (let j = 0; j < 3; j += 1) {
      const cid = (await q(`INSERT INTO ${SCHEMA}.children (id, parent_id, qty, note) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`, [pid, j, j === 0 ? null : `note ${j}`])).rows[0].id;
      await q(`INSERT INTO ${SCHEMA}.grandchildren VALUES ($1, 'a'), ($1, 'b')`, [cid]);
    }
  }
}, 120_000);

afterAll(async () => {
  await q(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
  await admin?.end().catch(() => {});
  await rm(dir, { recursive: true, force: true });
}, 60_000);

describe('table ordering', () => {
  it('puts parents before children and rejects circular references', () => {
    const order = orderByDependencies(new Map([['c', new Set(['b'])], ['b', new Set(['a'])], ['a', new Set()]]));
    expect(order).toEqual(['a', 'b', 'c']);
    expect(() => orderByDependencies(new Map([['a', new Set(['b'])], ['b', new Set(['a'])]]))).toThrow(/circular/i);
  });
});

describe('dump → verify → restore', () => {
  it('writes an encrypted dump whose contents verify', async () => {
    const file = path.join(dir, 'one.rbk');
    const dumped = await dumpToFile({ schema: SCHEMA, filePath: file, key });
    expect(dumped.encrypted).toBe(true);
    expect(dumped.tables).toEqual(['parents', 'children', 'grandchildren']);
    expect(dumped.counts).toEqual({ parents: 25, children: 75, grandchildren: 150 });
    const raw = await readFile(file);
    expect(raw.subarray(0, 4).toString()).toBe('RBK1');
    expect(raw.includes('parent 0')).toBe(false); // no plaintext in the file
    const info = await inspectBackupFile({ filePath: file, key });
    expect(info.rowCount).toBe(250);
  }, 60_000);

  it('detects a tampered file and a wrong key', async () => {
    const file = path.join(dir, 'tamper.rbk');
    await dumpToFile({ schema: SCHEMA, filePath: file, key });
    const bytes = await readFile(file);
    bytes[Math.floor(bytes.length / 2)] ^= 0xff;
    await writeFile(file, bytes);
    await expect(inspectBackupFile({ filePath: file, key })).rejects.toThrow();
    const good = path.join(dir, 'wrongkey.rbk');
    await dumpToFile({ schema: SCHEMA, filePath: good, key });
    await expect(inspectBackupFile({ filePath: good, key: keyFromHex(randomBytes(32).toString('hex')) })).rejects.toThrow();
  }, 60_000);

  it('restores the data exactly, replacing later changes', async () => {
    const file = path.join(dir, 'restore.rbk');
    const before = await q(`SELECT name, amount::text, meta::text FROM ${SCHEMA}.parents ORDER BY name`);
    await dumpToFile({ schema: SCHEMA, filePath: file, key });

    // Life goes on after the backup: rows deleted, added, changed.
    await q(`DELETE FROM ${SCHEMA}.grandchildren`);
    await q(`DELETE FROM ${SCHEMA}.children WHERE qty = 1`);
    await q(`UPDATE ${SCHEMA}.parents SET name = 'changed'`);
    await q(`INSERT INTO ${SCHEMA}.parents (id, name) VALUES (gen_random_uuid(), 'new after backup')`);

    const phases = [];
    await restoreFromFile({ schema: SCHEMA, filePath: file, key, onPhase: (p) => phases.push(p) });
    expect(phases).toContain('verifying');
    expect(await counts()).toEqual({ parents: 25, children: 75, grandchildren: 150 });
    const after = await q(`SELECT name, amount::text, meta::text FROM ${SCHEMA}.parents ORDER BY name`);
    expect(after.rows).toEqual(before.rows); // values, unicode, tabs/newlines, numeric precision, jsonb all identical
  }, 90_000);

  it('rolls everything back when a restore fails part-way', async () => {
    const plain = path.join(dir, 'plain.rbk');
    await dumpToFile({ schema: SCHEMA, filePath: plain, key: null });
    // Corrupt one child row so Postgres rejects it mid-restore (after the truncate and earlier inserts).
    const text = gunzipSync((await readFile(plain)).subarray(4)).toString('utf8');
    const broken = text.replace(/("qty":)\d+/, '$1"not a number"');
    expect(broken).not.toBe(text);
    await writeFile(plain, Buffer.concat([Buffer.from('RBK0'), gzipSync(broken)]));

    await q(`UPDATE ${SCHEMA}.parents SET name = 'live data'`);
    await expect(restoreFromFile({ schema: SCHEMA, filePath: plain, key: null })).rejects.toThrow();
    // Untouched: still the live data, nothing truncated.
    expect(await counts()).toEqual({ parents: 25, children: 75, grandchildren: 150 });
    expect((await q(`SELECT DISTINCT name FROM ${SCHEMA}.parents`)).rows).toEqual([{ name: 'live data' }]);
  }, 90_000);

  it('refuses a backup from a different schema version, changing nothing', async () => {
    const file = path.join(dir, 'version.rbk');
    await dumpToFile({ schema: SCHEMA, filePath: file, key });
    await q(`INSERT INTO ${SCHEMA}._prisma_migrations VALUES ('20260202_newer', now() + interval '1 minute')`);
    await expect(restoreFromFile({ schema: SCHEMA, filePath: file, key })).rejects.toThrow(/schema version/i);
    expect((await counts()).parents).toBe(25);
  }, 60_000);

  it('refuses when the table layout differs', async () => {
    const file = path.join(dir, 'layout.rbk');
    await q(`DELETE FROM ${SCHEMA}._prisma_migrations WHERE migration_name = '20260202_newer'`);
    await dumpToFile({ schema: SCHEMA, filePath: file, key });
    await q(`ALTER TABLE ${SCHEMA}.children ADD COLUMN extra text`);
    await expect(restoreFromFile({ schema: SCHEMA, filePath: file, key })).rejects.toThrow(/different columns/i);
    expect((await counts()).children).toBe(75);
  }, 60_000);
});
